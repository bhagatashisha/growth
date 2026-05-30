// UTM tagging utility — appends UTM params to all korrali.com links in outgoing content.
// This gives channel attribution in analytics: which email / post / comment drove a signup.

const KORRALI_DOMAINS = ["korrali.com", "trust.korrali.com", "revenue.korrali.com"];

export interface UtmParams {
  source:   string; // e.g. cold_email, reddit, hn, ih, linkedin
  medium:   string; // e.g. email, comment, post
  campaign: string; // e.g. campaign slug or "community"
  content?: string; // e.g. step number, subreddit, post title slug
}

export function buildUtmUrl(baseUrl: string, utm: UtmParams): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source",   utm.source);
    url.searchParams.set("utm_medium",   utm.medium);
    url.searchParams.set("utm_campaign", utm.campaign);
    if (utm.content) url.searchParams.set("utm_content", utm.content);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function isKorraliUrl(url: string): boolean {
  return KORRALI_DOMAINS.some((d) => url.includes(d));
}

// Inject UTM params into all korrali.com links found in a block of text or HTML
export function injectUtmIntoText(text: string, utm: UtmParams): string {
  return text.replace(
    /https?:\/\/[^\s"'<>)]+/g,
    (url) => (isKorraliUrl(url) ? buildUtmUrl(url, utm) : url),
  );
}
