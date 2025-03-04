import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { Operator } from '../operators/schemas/operator.schema';
import { TelegramAuthDto } from './telegram-auth.dto';

@Injectable()
export class TelegramAuthService {
    private readonly botToken: string;

    constructor(
        private configService: ConfigService,
        private jwtService: JwtService,
        @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    ) {
        this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!this.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
        }
    }

    generateToken(operator: Operator) {
        const payload = {
            sub: operator._id,
            username: operator.username,
            telegram_id: operator.tgProfile?.tgId
        };
        return this.jwtService.sign(payload);
    }

    /**
     * Validates Telegram authentication data
     * @param authData - The authentication data from Telegram
     * @returns boolean indicating if the data is valid
     */
    validateTelegramAuth(authData: TelegramAuthDto): boolean {
        // Check if auth_date is not older than 24 hours
        const authDate = parseInt(authData.auth_date, 10);
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime - authDate > 86400) {
            return false;
        }

        // Create data check string
        const { hash, ...data } = authData;
        const dataCheckString = Object.keys(data)
            .sort()
            .map(key => `${key}=${data[key]}`)
            .join('\n');

        // Create secret key
        const secretKey = createHash('sha256')
            .update(this.botToken)
            .digest();

        // Calculate hash
        const calculatedHash = createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        // Compare hashes
        return calculatedHash === hash;
    }

    /**
     * Authenticates a user with Telegram data
     * @param authData - The authentication data from Telegram
     * @returns The operator document or null if authentication fails
     */
    async authenticateWithTelegram(authData: TelegramAuthDto): Promise<Operator | null> {
        // Validate the authentication data
        if (!this.validateTelegramAuth(authData)) {
            return null;
        }

        // Check if user exists with this Telegram ID
        let operator = await this.operatorModel.findOne({
            'tgProfile.tgId': authData.id,
        });

        if (operator) {
            // Update the existing operator if needed
            if (authData.username && operator.tgProfile.tgUsername !== authData.username) {
                operator.tgProfile.tgUsername = authData.username;
                await operator.save();
            }
        } else {
            // Create a new operator if one doesn't exist
            // Generate a unique username based on Telegram username or ID
            const baseUsername = authData.username || `tg_${authData.id}`;
            let username = baseUsername;
            let counter = 1;

            // Ensure username is unique
            while (await this.operatorModel.findOne({ username })) {
                username = `${baseUsername}_${counter}`;
                counter++;
            }

            operator = await this.operatorModel.create({
                username,
                tgProfile: {
                    tgId: authData.id,
                    tgUsername: authData.username || `user_${authData.id}`,
                },
            });
        }

        return operator;
    }
}