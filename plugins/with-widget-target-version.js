const { withXcodeProject } = require("expo/config-plugins");

const DEFAULT_TARGET_NAME = "ExpoWidgetsTarget";
const DEFAULT_PODS_TARGET_NAME = "Pods-ExpoWidgetsTarget";
function setBuildSetting(buildSettings, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    buildSettings[key] = String(value);
  }
}

function normalizeXcodeValue(value) {
  return String(value || "").replace(/^"|"$/g, "");
}

function removeWidgetConfigureProjectPhase(project, target, podsTargetName) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
  const configureScriptPath = `${podsTargetName}/expo-configure-project.sh`;
  const phaseIdsToRemove = [];

  for (const [phaseId, phase] of Object.entries(phases)) {
    if (phaseId.endsWith("_comment")) {
      continue;
    }

    if (phase?.isa !== "PBXShellScriptBuildPhase") {
      continue;
    }

    const isExpoConfigureProject =
      normalizeXcodeValue(phase.name) === "[Expo] Configure project";
    const isWidgetConfigureProject = (phase.inputPaths || []).some((inputPath) =>
      normalizeXcodeValue(inputPath).includes(configureScriptPath)
    );

    if (isExpoConfigureProject && isWidgetConfigureProject) {
      phaseIdsToRemove.push(phaseId);
    }
  }

  if (phaseIdsToRemove.length === 0) {
    return;
  }

  target.buildPhases = (target.buildPhases || []).filter(
    (buildPhase) => !phaseIdsToRemove.includes(buildPhase.value)
  );

  for (const phaseId of phaseIdsToRemove) {
    delete phases[phaseId];
    delete phases[`${phaseId}_comment`];
  }
}

module.exports = function withWidgetTargetVersion(config, props = {}) {
  const targetName = props.targetName || DEFAULT_TARGET_NAME;
  const podsTargetName = props.podsTargetName || DEFAULT_PODS_TARGET_NAME;
  const marketingVersion = config.ios?.version || config.version;
  const buildNumber = config.ios?.buildNumber;

  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const target = project.pbxTargetByName(targetName);

    if (!target?.buildConfigurationList) {
      return modConfig;
    }

    const configurationList = project.pbxXCConfigurationList()[target.buildConfigurationList];
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const buildConfiguration of configurationList?.buildConfigurations || []) {
      const configuration = configurations[buildConfiguration.value];
      const buildSettings = configuration?.buildSettings;

      if (!buildSettings) {
        continue;
      }

      setBuildSetting(buildSettings, "MARKETING_VERSION", marketingVersion);
      setBuildSetting(buildSettings, "CURRENT_PROJECT_VERSION", buildNumber);
    }

    removeWidgetConfigureProjectPhase(project, target, podsTargetName);

    return modConfig;
  });
};
