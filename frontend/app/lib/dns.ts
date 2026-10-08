import type { DnsRecord } from "./types";

export const RECORD_TYPES = [
  { type: "A", label: "A – Routes traffic to an IPv4 address and some AWS resources", placeholder: "192.0.2.235", hint: "Enter IPv4 addresses, one per line." },
  { type: "AAAA", label: "AAAA – Routes traffic to an IPv6 address and some AWS resources", placeholder: "2001:db8:85a3::8a2e:370:7334", hint: "Enter IPv6 addresses, one per line." },
  { type: "CAA", label: "CAA – Restricts CAs that can create SSL/TLS certifications for the domain", placeholder: '0 issue "ca.example.net"', hint: "Format: flags tag \"value\". Enter multiple values on separate lines." },
  { type: "CNAME", label: "CNAME – Routes traffic to another domain name and to some AWS resources", placeholder: "www.example.com", hint: "Enter a single domain name." },
  { type: "MX", label: "MX – Routes traffic to mail servers", placeholder: "10 mail.example.com", hint: "Format: priority mail-server. Enter multiple values on separate lines." },
  { type: "NS", label: "NS – Routes traffic to a DNS namespace", placeholder: "ns-1.example.com", hint: "Enter name servers, one per line." },
  { type: "PTR", label: "PTR – Maps an IP address to a domain name", placeholder: "www.example.com", hint: "Enter a single domain name." },
  { type: "SRV", label: "SRV – Application-specific values that identify servers", placeholder: "1 10 5269 xmpp-server.example.com", hint: "Format: priority weight port target. Enter multiple values on separate lines." },
  { type: "TXT", label: "TXT – Verifies email senders and application-specific values", placeholder: '"Sample text"', hint: "Enter multiple values on separate lines." },
] as const;

/** Types the table filter offers; SOA exists only as the zone's default record. */
export const FILTER_TYPES = [...RECORD_TYPES.map((entry) => entry.type), "SOA"];

export const ROUTING_POLICIES = [
  { value: "Simple", label: "Simple routing" },
  { value: "Weighted", label: "Weighted" },
  { value: "Latency", label: "Latency" },
  { value: "Failover", label: "Failover" },
  { value: "Geolocation", label: "Geolocation" },
  { value: "Geoproximity", label: "Geoproximity" },
  { value: "Multivalue answer", label: "Multivalue answer" },
  { value: "IP-based", label: "IP-based" },
] as const;

export const ALIAS_TYPES = ["A", "AAAA", "CNAME"];

export const ALIAS_ENDPOINTS = [
  { label: "Alias to Application and Classic Load Balancer", placeholder: "my-load-balancer-1234567890.us-east-1.elb.amazonaws.com" },
  { label: "Alias to CloudFront distribution", placeholder: "d111111abcdef8.cloudfront.net" },
  { label: "Alias to API Gateway API", placeholder: "abcdef123.execute-api.us-east-1.amazonaws.com" },
  { label: "Alias to S3 website endpoint", placeholder: "s3-website-us-east-1.amazonaws.com" },
  { label: "Alias to another record in this hosted zone", placeholder: "www.example.com" },
];

export const TTL_PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];

/** Route 53 shows names without the trailing dot. */
export const displayName = (name: string) => name.replace(/\.$/, "");

/** Subdomain part of a record name inside its zone ("" for the apex). */
export function relativeName(recordName: string, zoneName: string) {
  if (recordName === zoneName) return "";
  return recordName.endsWith("." + zoneName) ? recordName.slice(0, -zoneName.length - 1) : recordName;
}

export const recordTtl = (record: DnsRecord) => (record.alias ? "-" : record.ttl.toLocaleString());

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso.endsWith("Z") ? iso : iso + "Z").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";
