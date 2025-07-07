import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import {
  HASHBEAR_BACKGROUNDS,
  HASHBEAR_FACES,
  HASHBEAR_HEADS,
  HASHBEAR_OUTERWEAR,
  HASHBEAR_SKINS,
} from 'src/common/constants/hashbear.constants';
import fs from 'fs';

export type TraitProbabilities = Record<string, number>;

export interface HashbearTraits {
  background: string;
  skin: string;
  face: string | null;
  head: string | null;
  outerwear: string | null;
}

@Injectable()
export class HashbearService {
  private readonly logger = new Logger(HashbearService.name);
  private readonly assetsPath = path.join(__dirname, '../../assets');
  private readonly outputPath = path.join(__dirname, '../../assets/output');

  async generateCollection(
    adminPassword: string,
    count: number,
  ): Promise<{ message: string; results: any[] }> {
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      throw new UnauthorizedException(
        '(generateCollection) Invalid admin password',
      );
    }

    const results = [];

    for (let tokenId = 1; tokenId <= count; tokenId++) {
      try {
        // Generate traits
        const traits = await this.generateHashbear();

        // Composite image
        const imagePath = await this.compositeHashbear(traits, tokenId);

        // Generate and save metadata
        const metadata = this.generateMetadata(traits, tokenId);
        this.saveMetadata(metadata, tokenId);

        results.push({
          tokenId,
          traits,
          imagePath,
          metadata,
        });
      } catch (error) {
        this.logger.error(`Failed to generate token ${tokenId}:`, error);
        throw new BadRequestException(
          `(generateCollection)Failed to generate token ${tokenId}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Generated ${results.length} Hashbear NFTs`);

    return {
      message: `Generated ${results.length} Hashbear NFTs`,
      results,
    };
  }

  /**
   * Composites the various layers of a Hashbear NFT.
   */
  async compositeHashbear(
    traits: HashbearTraits,
    tokenId: number,
  ): Promise<string> {
    const canvas = createCanvas(1024, 1024);
    const ctx = canvas.getContext('2d');

    // Layer order is important for proper compositing
    const layerOrder = ['background', 'skin', 'face', 'head', 'outerwear'];

    for (const layer of layerOrder) {
      const traitValue = traits[layer];
      if (traitValue) {
        // Convert layer's first letter to uppercase for filename consistency
        const capitalizedLayer = layer.charAt(0).toUpperCase() + layer.slice(1);
        const imagePath = path.join(
          this.assetsPath,
          `${capitalizedLayer}_${traitValue}.png`,
        );

        if (fs.existsSync(imagePath)) {
          const img = await loadImage(imagePath);
          ctx.drawImage(img, 0, 0, 1024, 1024);
          this.logger.log(`Composited ${capitalizedLayer}: ${traitValue}`);
        } else {
          this.logger.warn(`Missing image: ${imagePath}`);
        }
      }
    }

    // Save the final composite image
    const buffer = canvas.toBuffer('image/png');
    const outputFilename = `${tokenId}.png`;
    const outputPath = path.join(this.outputPath, 'images', outputFilename);

    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }

  /**
   * Generates metadata for a Hashbear NFT.
   */
  generateMetadata(traits: HashbearTraits, tokenId: number): object {
    const attributes = [];

    // Add all traits as attributes
    for (const [traitType, traitValue] of Object.entries(traits)) {
      if (traitValue) {
        attributes.push({
          trait_type: traitType.charAt(0).toUpperCase() + traitType.slice(1),
          value: traitValue.charAt(0).toUpperCase() + traitValue.slice(1),
        });
      }
    }

    return {
      name: `Hashbear #${tokenId}`,
      description:
        'A unique Hashbear from the collection with randomly generated traits',
      image: `${tokenId}.png`, // Will be updated with IPFS hash later
      attributes,
      compiler: 'Hashbear Generator v1.0',
    };
  }

  /**
   * Saves the generated metadata to a JSON file.
   */
  saveMetadata(metadata: object, tokenId: number): void {
    const metadataPath = path.join(
      __dirname,
      '../../output/json',
      `${tokenId}.json`,
    );
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Performs weighted random selection from trait probabilities
   */
  private weightedRandom(weights: TraitProbabilities): string {
    const random = Math.random();
    let sum = 0;

    for (const [trait, weight] of Object.entries(weights)) {
      sum += weight;
      if (random <= sum) {
        return trait;
      }
    }

    // Fallback to first trait if something goes wrong
    return Object.keys(weights)[0];
  }

  /**
   * Generates a Hashbear NFT by randomly selecting traits based on their probabilities.
   */
  async generateHashbear(): Promise<HashbearTraits> {
    this.logger.log('Generating a new Hashbear NFT...');

    // Always required traits
    const selectedSkin = this.weightedRandom(HASHBEAR_SKINS);
    const selectedBackground = this.weightedRandom(HASHBEAR_BACKGROUNDS);

    // Face selection depends on skin type
    let selectedFace: string | null = null;
    if (!['gold', 'robot', 'skeleton'].includes(selectedSkin)) {
      selectedFace = this.weightedRandom(HASHBEAR_FACES);
      this.logger.log(`Selected face: ${selectedFace}`);
    } else {
      this.logger.log(`Skipping face selection for ${selectedSkin} skin`);
    }

    // Head and outerwear can be 'none' (50% chance each)
    const selectedHead = this.weightedRandom(HASHBEAR_HEADS);
    const selectedOuterwear = this.weightedRandom(HASHBEAR_OUTERWEAR);

    const result: HashbearTraits = {
      skin: selectedSkin,
      background: selectedBackground,
      face: selectedFace,
      head: selectedHead === 'none' ? null : selectedHead,
      outerwear: selectedOuterwear === 'none' ? null : selectedOuterwear,
    };

    this.logger.log('Generated Hashbear traits:', result);
    return result;
  }

  /**
   * Helper method to construct image filename from trait
   */
  private constructImagePath(traitType: string, traitValue: string): string {
    const capitalizedType =
      traitType.charAt(0).toUpperCase() + traitType.slice(1);
    const capitalizedValue =
      traitValue.charAt(0).toUpperCase() + traitValue.slice(1);
    return `${capitalizedType}_${capitalizedValue}.png`;
  }

  /**
   * Gets all image paths needed for a generated Hashbear
   */
  getImagePaths(traits: HashbearTraits): string[] {
    const imagePaths: string[] = [];

    // Always include background and skin
    imagePaths.push(this.constructImagePath('background', traits.background));
    imagePaths.push(this.constructImagePath('skin', traits.skin));

    // Include face if present
    if (traits.face) {
      imagePaths.push(this.constructImagePath('face', traits.face));
    }

    // Include head if present
    if (traits.head) {
      imagePaths.push(this.constructImagePath('head', traits.head));
    }

    // Include outerwear if present
    if (traits.outerwear) {
      imagePaths.push(this.constructImagePath('outerwear', traits.outerwear));
    }

    return imagePaths;
  }
}
