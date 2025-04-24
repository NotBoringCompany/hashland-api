import * as Mixpanel from 'mixpanel';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MixpanelService {
  private ALLOW_MIXPANEL: boolean = true; // 👈 toggle manually here
  private mixpanel: any;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('MIXPANEL_PROJECT_TOKEN');

    if (!token) {
      throw new Error(
        '(MixpanelService) MIXPANEL_PROJECT_TOKEN is not defined in environment variables',
      );
    }

    this.mixpanel = Mixpanel.init(token, {
      debug: true,
      protocol: 'https',
    });
  }

  /**
   * Tracks an event in Mixpanel.
   */
  track(eventName: string, action: any = {}): void {
    if (!this.ALLOW_MIXPANEL) return;
    this.mixpanel.track(eventName, action);
  }
}
