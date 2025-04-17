import * as Mixpanel from 'mixpanel';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MixpanelService {
  private mixpanel: any;

  constructor(private configService: ConfigService) {
    this.mixpanel = Mixpanel.init(
      this.configService.get<string>('MIXPANEL_PROJECT_TOKEN'),
      {
        debug: true,
        protocol: 'https',
      },
    );
  }

  public track(eventName: string, action: any = {}): void {
    this.mixpanel.track(eventName, action);
  }
}
