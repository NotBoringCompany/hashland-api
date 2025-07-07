/**
 * Represents the background trait data for the Hashbear NFT collection.
 */
export const BACKGROUNDS = {
  required: true,
  /**
   * Represents the different obtainable backgrounds and their chances (from 0 to 1) of obtaining them.
   */
  data: {
    cave: 0.05,
    city: 0.05,
    gold: 0.05,
    yellow: 0.2125,
    blue: 0.2125,
    green: 0.2125,
    red: 0.2125,
  },
};

/**
 * Represents the skin trait data for the Hashbear NFT collection.
 */
export const SKINS = {
  required: true,
  data: {
    brown: 0.3,
    white: 0.3,
    panda: 0.14,
    redPanda: 0.14,
    skeleton: 0.075,
    robot: 0.04,
    gold: 0.005,
  },
};

/**
 * Represents the face trait data for the Hashbear NFT collection.
 */
export const FACES = {
  required: true,
  /**
   * Represents the different obtainable faces and their chances (from 0 to 1) of obtaining them.
   */
  data: {
    bored: 0.08333,
    calm: 0.08333,
    cigarette: 0.08333,
    eyepatch: 0.08333,
    glasses3D: 0.08333,
    glassesHearts: 0.08333,
    lookLeft: 0.08333,
    lookRight: 0.08333,
    monocle: 0.08333,
    smug: 0.08333,
    sunglasses: 0.08333,
    wink: 0.08333,
  },
};

/**
 * Represents the head trait data for the Hashbear NFT collection.
 */
export const HEADS = {
  required: false,
  /**
   * Represents the different obtainable heads and their chances (from 0 to 1) of obtaining them.
   */
  data: {
    bird: 0.1,
    crownGold: 0.1,
    flowerCrown: 0.1,
    halo: 0.1,
    headphones: 0.1,
    hornsDevil: 0.1,
    magicianHat: 0.1,
    mushroomHat: 0.1,
    pirate: 0.1,
    wizard: 0.1,
  },
};

/**
 * Represents the outerwear trait data for the Hashbear NFT collection.
 */
export const OUTERWEAR = {
  required: false,
  /**
   * Represents the different obtainable outerwears and their chances (from 0 to 1) of obtaining them.
   */
  data: {
    bowTie: 0.111,
    redCape: 0.111,
    farmer: 0.111,
    goldChain: 0.111,
    leatherJacket: 0.111,
    ninja: 0.111,
    purpleScarf: 0.111,
    spaceSuit: 0.111,
    blackSuit: 0.111,
  },
};
