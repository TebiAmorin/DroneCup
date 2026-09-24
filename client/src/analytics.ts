/**
 * GA4 analytics wrapper.
 *
 * Configure by setting VITE_GA_MEASUREMENT_ID in the client .env file.
 * If the variable is not set, all tracking calls are silently ignored.
 *
 * UTM convention (for future campaign URLs — do NOT modify existing links yet):
 *   utm_source:   twitch | twitter | youtube | discord | ubisoft
 *   utm_medium:   social | stream | chat | email | banner | partner
 *   utm_campaign: drone_cup
 *   utm_content:  <creator slug>  (vetel, caramelo, miwell, sora, barra)
 *
 * Example: ?utm_source=twitch&utm_medium=stream&utm_campaign=drone_cup&utm_content=vetel
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function bootstrap(): void {
  if (!GA_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });
}

bootstrap();

type EventName = 'streamer_card_click' | 'registration_click';

interface EventParams {
  streamer?: string;
  platform?: string;
}

export function trackPageView(path: string): void {
  if (!window.gtag || !GA_ID) return;
  window.gtag('event', 'page_view', { page_path: path, page_title: document.title });
}

export function trackEvent(name: EventName, params?: EventParams): void {
  if (!window.gtag) return;
  window.gtag('event', name, params);
}
