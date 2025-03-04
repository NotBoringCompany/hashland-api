import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthController } from './telegram-auth.controller';
import { Operator, OperatorSchema } from '../operators/schemas/operator.schema';

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: Operator.name, schema: OperatorSchema },
        ]),
    ],
    controllers: [TelegramAuthController],
    providers: [TelegramAuthService],
    exports: [TelegramAuthService],
})
export class AuthModule { }