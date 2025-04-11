/**
 * A set of constants that define Hashland's game rules and mechanics.
 */
export const GAME_CONSTANTS = {
  /**
   * Cycle constants.
   */
  CYCLES: {
    /**
     * The total number of drilling cycles that can be created.
     */
    TOTAL_CYCLES: 2_000_000,
    /**
     * The duration of a drilling cycle in seconds.
     */
    CYCLE_DURATION: 8,
    /**
     * If drilling cycle creation is enabled.
     *
     * If this is `false`, no new drilling cycles will be created.
     */
    ENABLED: true,
    /**
     * The number of cycles that pass before a new epoch begins and $HASH issuance is halved.
     */
    EPOCH_CYCLE_COUNT: 200_000,
    /**
     * The amount of $HASH issued on the genesis epoch (Epoch 0).
     *
     * The actual issuance will vary depending on which epoch the current cycle is in.
     */
    GENESIS_EPOCH_HASH_ISSUANCE: 512,
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
    /**
     * The prerequisites for purchasing a Bulwark drill from the shop.
     */
    BULWARK_DRILL_PURCHASE_PREREQUISITES: {
      /**
       * Minimum amount of Ironbore drills required to purchase a Bulwark drill.
       */
      ironboreDrillsRequired: 1,
      /**
       * The minimum `maxFuel` required to purchase a Bulwark drill.
       */
      maxFuelRequired: 130000,
    },
    /**
     * The prerequisites for purchasing a Titan drill from the shop.
     */
    TITAN_DRILL_PURCHASE_PREREQUISITES: {
      /**
       * Minimum amount of Bulwark drills required to purchase a Titan drill.
       */
      bulwarkDrillsRequired: 1,
      /**
       * The minimum `maxFuel` required to purchase a Titan drill.
       */
      maxFuelRequired: 450000,
    },
    /**
     * The prerequisites for purchasing a Dreadnought drill from the shop.
     */
    DREADNOUGHT_DRILL_PURCHASE_PREREQUISITES: {
      /**
       * Minimum amount of Titan drills required to purchase a Dreadnought drill.
       */
      titanDrillsRequired: 1,
      /**
       * The minimum `maxFuel` required to purchase a Dreadnought drill.
       */
      maxFuelRequired: 950000,
    },
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
       * The total % (in ratio format) of $HASH rewards that are distributed to the extractor's operator on that cycle.
       */
      extractorOperator: 0.55,
      /**
       * The total % (in ratio format) of $HASH rewards that are distributed to all other active operators on that cycle.
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
  },

  /**
   * Fuel constants.
   */
  FUEL: {
    /**
     * How much starting fuel the operator gets when registering.
     */
    OPERATOR_STARTING_FUEL: 15000,
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

  /**
   * Luck constants.
   */
  LUCK: {
    /**
     * The minimum luck multiplier that can be applied to an operator's EFF rating.
     */
    MIN_LUCK_MULTIPLIER: 1,
    /**
     * The maximum luck multiplier that can be applied to an operator's EFF rating.
     */
    MAX_LUCK_MULTIPLIER: 1.1,
  },

  /**
   * Extractor constants.
   */
  EXTRACTOR: {
    /**
     * The minimum asset equity threshold required for an extractor to be valid.
     *
     * For instance, if the operator's asset equity is $1000 and the minimum threshold is 0.8,
     * the operator must have AT LEAST $800 in asset equity upon checking for extractor validity.
     * If not, the operator will not be considered as a valid extractor and the cycle will not have an extractor.
     */
    OPERATOR_MINIMUM_ASSET_EQUITY_THRESHOLD: 0.8,
  },

  /**
   * Wallet constants.
   */
  WALLET: {
    /**
     * The minimum asset equity threshold required to update the total USD balance of the operator's asset equity.
     */
    MINIMUM_USD_BALANCE_THRESHOLD: 5,
  },
};
