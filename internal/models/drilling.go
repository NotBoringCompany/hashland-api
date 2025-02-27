package models

import (
	"time"

	"github.com/google/uuid"
)

// A drilling session is a period of time during which an operator starts drilling for $HASH
// per drilling cycle.
type DrillingSession struct {
	SessionID  int       `json:"session_id" db:"session_id"`   // The session's auto-incrementing database ID.
	OperatorID uuid.UUID `json:"operator_id" db:"operator_id"` // The database ID of the operator who started the session.
	StartTime  time.Time `json:"start_time" db:"start_time"`   // The session's start time.

	// The session's end time.
	// If a session has not yet ended, this value will be null.
	EndTime *time.Time `json:"end_time,omitempty" db:"end_time"`

	EarnedHASH float64 `json:"earned_hash" db:"earned_hash"` // The operator's earned $HASH during the session.
}

// A drilling cycle is a period of time during which operators are able to compete to extract $HASH from the land.
// This shares a similar concept to a "block" in blockchain mining.
type DrillingCycle struct {
	CycleID     int        `json:"cycle_id" db:"cycle_id"`           // The cycle's auto-incrementing database ID. Also used to determine the cycle number since the genesis cycle.
	StartTime   time.Time  `json:"start_time" db:"start_time"`       // The cycle's start time.
	EndTime     *time.Time `json:"end_time,omitempty" db:"end_time"` // The cycle's end time.
	ExtractorID uuid.UUID  `json:"extractor_id" db:"extractor_id"`   // The database ID of the drill that successfully extracted the $HASH of this cycle.

	// The number of operators who participated in this cycle.
	// This also includes operators who start or end in the middle of the cycle and thus are ineligible to earn extractor rewards.
	ActiveOperators uint `json:"active_operators" db:"active_operators"`

	CycleComplexity uint32  `json:"cycle_complexity" db:"cycle_complexity"` // A unit of measurement on how complex the cycle is for a drill to be an extractor.
	IssuedHASH      float64 `json:"issued_hash" db:"issued_hash"`           // How much $HASH is issued to the extractor of this cycle.
}

// A drill is an equipment that operators use to extract $HASH from the land.
// Think of it similar to a mining rig in blockchain mining.
type Drill struct {
	DrillID          uuid.UUID    `json:"drill_id" db:"drill_id"`                   // The drill's database ID.
	Version          DrillVersion `json:"version" db:"version"`                     // The drill's version.
	Config           DrillConfig  `json:"config" db:"config"`                       // The drill's configuration.
	ExtractorAllowed bool         `json:"extractor_allowed" db:"extractor_allowed"` // Whether this drill is allowed to be an extractor.
	Level            uint8        `json:"level" db:"level"`                         // The drill's level. Defaults to 1.
	ActualEff        uint32       `json:"actual_eff" db:"actual_eff"`               // The drill's actual efficiency rating.
}

// Represents a drill version.
type DrillVersion string

// Represents a drill configuration.
type DrillConfig string

const (
	BasicConfig       DrillConfig = "BASIC_CONFIG"
	IronboreConfig    DrillConfig = "IRONBORE_CONFIG"
	BulwarkConfig     DrillConfig = "BULWARK_CONFIG"
	TitanConfig       DrillConfig = "TITAN_CONFIG"
	DreadnoughtConfig DrillConfig = "DREADNOUGHT_CONFIG"
)

const (
	BasicVersion   DrillVersion = "BASIC_VERSION"
	PremiumVersion DrillVersion = "PREMIUM_VERSION"
)

// A map of drill configurations. Using a struct avoids
// unnecessary string comparisons and allows direct key lookups.
var DrillConfigs = map[DrillConfig]struct{}{
	BasicConfig:       {},
	IronboreConfig:    {},
	BulwarkConfig:     {},
	TitanConfig:       {},
	DreadnoughtConfig: {},
}

// A map of drill versions. Using a struct avoids
// unnecessary string comparisons and allows direct key lookups.
var DrillVersions = map[DrillVersion]struct{}{
	BasicVersion:   {},
	PremiumVersion: {},
}
