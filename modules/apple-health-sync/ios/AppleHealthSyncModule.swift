import ExpoModulesCore
import HealthKit

private final class AppleHealthSyncException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    param
  }
}

public final class AppleHealthSyncModule: Module {
  private let healthStore = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("AppleHealthSync")

    AsyncFunction("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("authorizationStatus") { () -> [String: Any] in
      self.authorizationStatusPayload()
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve([
          "available": false,
          "requestSucceeded": false,
          "allAuthorized": false,
          "statuses": [:]
        ])
        return
      }

      let shareTypes = Self.shareTypes()

      DispatchQueue.main.async {
        self.healthStore.requestAuthorization(
          toShare: shareTypes,
          read: Set<HKObjectType>()
        ) { success, error in
          if let error {
            promise.reject(AppleHealthSyncException(error.localizedDescription))
            return
          }

          var payload = self.authorizationStatusPayload()
          payload["requestSucceeded"] = success
          promise.resolve(payload)
        }
      }
    }

    AsyncFunction("writeRecords") { (records: [[String: Any]], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject(AppleHealthSyncException("Apple Health is not available on this device."))
        return
      }

      guard self.hasWriteAuthorization() else {
        promise.reject(AppleHealthSyncException("Apple Health write permission was not granted for every sync data type."))
        return
      }

      do {
        let objects = try records.map { try self.makeObject(from: $0) }

        guard !objects.isEmpty else {
          promise.resolve([
            "requested": records.count,
            "saved": 0
          ])
          return
        }

        self.healthStore.save(objects) { success, error in
          if let error {
            promise.reject(AppleHealthSyncException(error.localizedDescription))
            return
          }

          guard success else {
            promise.reject(AppleHealthSyncException("Apple Health did not save the records."))
            return
          }

          promise.resolve([
            "requested": records.count,
            "saved": objects.count
          ])
        }
      } catch let exception as Exception {
        promise.reject(exception)
      } catch {
        promise.reject(AppleHealthSyncException(error.localizedDescription))
      }
    }
  }

  private static func shareTypes() -> Set<HKSampleType> {
    var types: Set<HKSampleType> = [HKObjectType.workoutType()]

    if let bodyMass = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
      types.insert(bodyMass)
    }

    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      types.insert(sleep)
    }

    return types
  }

  private func authorizationStatusPayload() -> [String: Any] {
    let statuses = Self.shareTypes().reduce(into: [String: String]()) { result, type in
      result[type.identifier] = Self.statusName(healthStore.authorizationStatus(for: type))
    }

    return [
      "available": HKHealthStore.isHealthDataAvailable(),
      "requestSucceeded": true,
      "allAuthorized": hasWriteAuthorization(),
      "statuses": statuses
    ]
  }

  private func hasWriteAuthorization() -> Bool {
    Self.shareTypes().allSatisfy { healthStore.authorizationStatus(for: $0) == .sharingAuthorized }
  }

  private static func statusName(_ status: HKAuthorizationStatus) -> String {
    switch status {
    case .notDetermined:
      return "notDetermined"
    case .sharingDenied:
      return "sharingDenied"
    case .sharingAuthorized:
      return "sharingAuthorized"
    @unknown default:
      return "unknown"
    }
  }

  private func makeObject(from record: [String: Any]) throws -> HKObject {
    guard let kind = Self.stringValue(record["kind"]) else {
      throw AppleHealthSyncException("Missing Apple Health record kind.")
    }

    switch kind {
    case "weight":
      return try makeWeightSample(from: record)
    case "sleep":
      return try makeSleepSample(from: record)
    case "workout":
      return try makeWorkout(from: record)
    default:
      throw AppleHealthSyncException("Unsupported Apple Health record kind: \(kind).")
    }
  }

  private func makeWeightSample(from record: [String: Any]) throws -> HKQuantitySample {
    guard let sampleType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
      throw AppleHealthSyncException("Body mass is not available in HealthKit.")
    }

    guard let valueKg = Self.doubleValue(record["valueKg"]), valueKg > 0 else {
      throw AppleHealthSyncException("Weight record is missing a positive valueKg.")
    }

    guard let start = Self.dateValue(record["startTime"]) else {
      throw AppleHealthSyncException("Weight record is missing startTime.")
    }

    let quantity = HKQuantity(unit: HKUnit.gramUnit(with: .kilo), doubleValue: valueKg)
    return HKQuantitySample(
      type: sampleType,
      quantity: quantity,
      start: start,
      end: start,
      metadata: try metadata(from: record)
    )
  }

  private func makeSleepSample(from record: [String: Any]) throws -> HKCategorySample {
    guard let sampleType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
      throw AppleHealthSyncException("Sleep analysis is not available in HealthKit.")
    }

    guard
      let start = Self.dateValue(record["startTime"]),
      let end = Self.dateValue(record["endTime"]),
      end > start
    else {
      throw AppleHealthSyncException("Sleep record is missing a valid startTime/endTime interval.")
    }

    let value: Int
    if #available(iOS 16.0, *) {
      value = HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
    } else {
      value = HKCategoryValueSleepAnalysis.asleep.rawValue
    }

    return HKCategorySample(
      type: sampleType,
      value: value,
      start: start,
      end: end,
      metadata: try metadata(from: record)
    )
  }

  private func makeWorkout(from record: [String: Any]) throws -> HKWorkout {
    guard
      let start = Self.dateValue(record["startTime"]),
      let end = Self.dateValue(record["endTime"]),
      end > start
    else {
      throw AppleHealthSyncException("Workout record is missing a valid startTime/endTime interval.")
    }

    let activityType = Self.workoutActivityType(from: Self.stringValue(record["googleExerciseType"]))
    let energyBurned = Self.doubleValue(record["caloriesKcal"]).flatMap { value -> HKQuantity? in
      value > 0 ? HKQuantity(unit: .kilocalorie(), doubleValue: value) : nil
    }
    let distance = Self.doubleValue(record["distanceMeters"]).flatMap { value -> HKQuantity? in
      value > 0 ? HKQuantity(unit: .meter(), doubleValue: value) : nil
    }

    return HKWorkout(
      activityType: activityType,
      start: start,
      end: end,
      workoutEvents: nil,
      totalEnergyBurned: energyBurned,
      totalDistance: distance,
      metadata: try metadata(from: record)
    )
  }

  private func metadata(from record: [String: Any]) throws -> [String: Any] {
    guard let syncIdentifier = Self.stringValue(record["syncIdentifier"]) else {
      throw AppleHealthSyncException("Record is missing syncIdentifier.")
    }

    guard let syncVersion = Self.intValue(record["syncVersion"]), syncVersion > 0 else {
      throw AppleHealthSyncException("Record is missing a positive syncVersion.")
    }

    var metadata: [String: Any] = [
      HKMetadataKeySyncIdentifier: syncIdentifier,
      HKMetadataKeySyncVersion: syncVersion,
      HKMetadataKeyWasUserEntered: false,
      "OpenFitSyncSource": "google-health"
    ]

    if let sourceId = Self.stringValue(record["sourceId"]) {
      metadata["OpenFitGoogleSourceId"] = sourceId
    }

    if let sourceDataType = Self.stringValue(record["sourceDataType"]) {
      metadata["OpenFitGoogleDataType"] = sourceDataType
    }

    if let payloadHash = Self.stringValue(record["payloadHash"]) {
      metadata["OpenFitGooglePayloadHash"] = payloadHash
    }

    if let name = Self.stringValue(record["name"]) {
      metadata["OpenFitDisplayName"] = name
    }

    return metadata
  }

  private static func workoutActivityType(from googleType: String?) -> HKWorkoutActivityType {
    switch googleType?.uppercased() {
    case "RUNNING", "RUN", "TREADMILL", "TRAIL_RUN":
      return .running
    case "WALKING", "WALK", "TREADMILL_WALK", "NORDIC_WALKING", "POWER_WALKING", "HIKING":
      return googleType?.uppercased() == "HIKING" ? .hiking : .walking
    case "BIKING", "BICYCLING", "CYCLING", "OUTDOOR_BIKE", "ROAD_BIKING", "MOUNTAIN_BIKE", "STATIONARY_BIKE", "SPINNING":
      return .cycling
    case "SWIMMING", "SWIM", "SWIMMING_POOL", "SWIMMING_OPEN_WATER":
      return .swimming
    case "YOGA":
      return .yoga
    case "PILATES":
      return .pilates
    case "ROWING", "ROWING_MACHINE":
      return .rowing
    case "ELLIPTICAL":
      return .elliptical
    case "HIIT", "INTERVAL_WORKOUT", "TABATA_WORKOUT":
      return .highIntensityIntervalTraining
    case "STRENGTH_TRAINING", "WEIGHTLIFTING", "WEIGHTS", "FREE_WEIGHTS", "WEIGHT_MACHINES":
      return .traditionalStrengthTraining
    default:
      return .other
    }
  }

  private static func stringValue(_ value: Any?) -> String? {
    guard let value else {
      return nil
    }

    if let string = value as? String, !string.isEmpty {
      return string
    }

    return nil
  }

  private static func doubleValue(_ value: Any?) -> Double? {
    switch value {
    case let value as Double:
      return value.isFinite ? value : nil
    case let value as Float:
      return value.isFinite ? Double(value) : nil
    case let value as Int:
      return Double(value)
    case let value as NSNumber:
      let double = value.doubleValue
      return double.isFinite ? double : nil
    case let value as String:
      let double = Double(value)
      return double?.isFinite == true ? double : nil
    default:
      return nil
    }
  }

  private static func intValue(_ value: Any?) -> Int? {
    switch value {
    case let value as Int:
      return value
    case let value as NSNumber:
      return value.intValue
    case let value as Double:
      return value.isFinite ? Int(value) : nil
    case let value as String:
      return Int(value)
    default:
      return nil
    }
  }

  private static func dateValue(_ value: Any?) -> Date? {
    guard let string = stringValue(value) else {
      return nil
    }

    return iso8601WithFractionalSeconds.date(from: string) ?? iso8601.date(from: string)
  }

  private static let iso8601: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  private static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}
