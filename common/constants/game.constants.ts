/**
 * A set of constants that define Hashland's game rules and mechanics.
 */
export const GAME_CONSTANTS = {
  /**
   * Cycle constants.
   */
  CYCLES: {
    /**
     * The duration of a drilling cycle in seconds.
     */
    CYCLE_DURATION: 10,
  },

  /**
   * Drill constants.
   */
  DRILLS: {
    /**
     * How many basic drills are allowed per operator, excluding upgrades.
     */
    BASE_BASIC_DRILLS_ALLOWED: 1,
    /**
     * How many premium drills are allowed per operator, excluding upgrades.
     */
    BASE_PREMIUM_DRILLS_ALLOWED: 5,
  },

  /**
   * Hash issuance constants.
   */
  HASH_ISSUANCE: {
    /**
     * The amount of $HASH issued per cycle.
     */
    CYCLE_HASH_ISSUANCE: 300,
  },

  /**
   * Reward constants.
   */
  REWARDS: {
    /**
     * The reward system for solo operators (i.e. if the extractor of a cycle is owned by a solo operator).
     */
    SOLO_OPERATOR_REWARD_SYSTEM: {
      /**
       * The total % of $HASH rewards that are distributed to the extractor's operator on that cycle.
       */
      extractorOperator: 0.55,
      /**
       * The total % of $HASH rewards that are distributed to all other active operators on that cycle.
       */
      allActiveOperators: 0.45,
    },
  },

  /**
   * Pool constants.
   */
  POOLS: {
    /**
     * An array of prerequisites for creating a pool.
     *
     * Each index represents the prerequisite choices and the cost for a pool creation.
     * If an index has an empty array for prerequisites, that means that there are no prerequisites should the operator choose that index.
     * This logic is the same with the costs array - if an index has an empty array for costs, that means that there are no costs should the operator choose that index.
     *
     * NOTE: There should NOT be an index with both empty prerequisites and costs; either or needs to be present.
     */
    POOL_CREATION_PREREQUISITES_AND_COSTS: [
      // in order for an operator to choose this, they need to have met the `minHASHEarned` prerequisite.
      // however, they will only need to pay 5 TON.
      {
        prerequisites: [
          {
            type: 'minHASHEarned',
            value: 1000000,
          },
        ],
        costs: [
          {
            type: 'TON',
            value: 5,
          },
        ],
      },
      // no prerequisites, but the operator needs to pay 10 TON to create a pool.
      {
        prerequisites: [],
        costs: [
          {
            type: 'TON',
            value: 10,
          },
        ],
      },
    ],
  },

  /**
   * Economy constants.
   */
  ECONOMY: {
    /**
     * How many TG Stars are equivalent to 1 USD.
     */
    USD_TO_STARS: 66.666666,
    /**
     * The cost (in TON) to increase the operator's max fuel each upgrade.
     */
    INCREASE_MAX_FUEL_COST: 0.7,
    /**
     * How much the operator's max fuel can increase per upgrade.
     */
    INCREASE_MAX_FUEL_VALUE: 6000,
  },

  /**
   * Operator constants.
   */
  OPERATOR: {
    /**
     * How much starting fuel the operator gets when registering.
     */
    OPERATOR_STARTING_FUEL: 15000,
  },

  /**
   * Fuel constants.
   */
  FUEL: {
    /**
     * How much fuel is depleted per cycle for active operators.
     */
    BASE_FUEL_DEPLETION_RATE: {
      minUnits: 95,
      maxUnits: 325,
    },
    /**
     * How much fuel is regenerated per cycle for non-active operators.
     */
    BASE_FUEL_REGENERATION_RATE: {
      minUnits: 6,
      maxUnits: 10,
    },
  },

  /**
   * Efficiency constants.
   */
  EFFICIENCY: {
    /**
     * How much the operator's max EFF rating can increase per 1 USD worth of equity.
     */
    EQUITY_TO_MAX_EFF: 100,
  },
};
