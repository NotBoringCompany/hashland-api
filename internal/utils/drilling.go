package utils

import "github.com/NotBoringCompany/hashland-api/internal/models"

// Checks if a drill configuration is a valid DrillConfig type.
func IsValidDrillConfig(config models.DrillConfig) bool {
	_, exists := models.DrillConfigs[config]
	return exists
}

// Checks if a drill version is a valid DrillVersion type.
func IsValidDrillVersion(version models.DrillVersion) bool {
	_, exists := models.DrillVersions[version]
	return exists
}
