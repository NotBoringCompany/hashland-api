/**
 * A set of constants that define Hashland's game rules and mechanics.
 */
export const GAME_CONSTANTS = {
  OPERATORS: {
    /**
     * The cooldown time (in seconds) for renaming an operator's username.
     */
    RENAME_COOLDOWN: 604_800, // 7 days in seconds
    /**
     * The cooldown time (in seconds) for joining a pool after previously having joined a pool (assuming the operator leaves).
     */
    JOIN_POOL_COOLDOWN: 28_800, // 8 hours in seconds
  },

  /**
   * Referral system constants.
   */
  REFERRAL: {
    /**
     *
     */
    REFERRAL_REWARDS_THRESHOLD: 5,
    /**
     * Rewards given to the referrer when a new user signs up using their code.
     */
    REFERRER_REWARDS: {
      /**
       * Efficiency credits given to the referrer.
       */
      EFF_CREDITS: 25,
      /**
       * Hash bonus given to the referrer.
       */
      HASH_BONUS: 0,
    },
    /**
     * Rewards given to the referred user when signing up with a referral code.
     */
    REFERRED_REWARDS: {
      /**
       * Efficiency credits given to the referred user.
       */
      EFF_CREDITS: 10,
      /**
       * Hash bonus given to the referred user.
       */
      HASH_BONUS: 0,
    },
    /**
     * Length of the generated referral code.
     */
    CODE_LENGTH: 12,
  },

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
     * The total aimed issuance of $HASH until `TOTAL_CYCLES` are reached.
     */
    TOTAL_HASH_ISSUANCE: 204_600_000,
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
     * How many active drills are allowed per operator initially.
     */
    INITIAL_ACTIVE_DRILLS_ALLOWED: 5,
    /**
     * How many active drills are allowed per operator after upgrades.
     *
     * This will be the hard cap, i.e. no more upgrades will be able to increase this number.
     */
    MAX_ACTIVE_DRILLS_ALLOWED: 10,
    /**
     * The cooldown time (in seconds) for toggling the active state of a drill.
     */
    ACTIVE_STATE_TOGGLE_COOLDOWN: 28_800, // 8 hours
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
    /**
     * How much the operator's max EFF rating can increase per 1 USD worth of equity.
     */
    EQUITY_TO_MAX_EFF: 100,
    /**
     * The minimum asset equity threshold required for an extractor to be valid.
     *
     * For instance, if the operator's asset equity is $1000 and the minimum threshold is 0.8,
     * the operator must have AT LEAST $800 in asset equity upon checking for extractor validity.
     * If not, the operator will not be considered as a valid extractor and the cycle will not have an extractor.
     */
    OPERATOR_MINIMUM_ASSET_EQUITY_THRESHOLD: 0.8,
    /**
     * The minimum asset equity threshold required to update the total USD balance of the operator's asset equity.
     */
    MINIMUM_USD_BALANCE_THRESHOLD: 5,
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
      minUnits: 295,
      maxUnits: 650,
    },
    /**
     * How much fuel is regenerated per cycle for non-active operators.
     */
    BASE_FUEL_REGENERATION_RATE: {
      minUnits: 7,
      maxUnits: 12,
    },
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
};
