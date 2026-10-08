/** Content for the "Info" help panel. Mirrors the short explanations the Route 53 console shows. */
export type HelpTopic = { title: string; body: string[]; important?: string[]; learnMore?: string };

export const HELP: Record<string, HelpTopic> = {
  "hosted-zones": {
    title: "Hosted zones",
    body: [
      "A hosted zone is a container for records, and records contain information about how you want to route traffic for a specific domain, such as example.com, and its subdomains.",
      "A hosted zone and the corresponding domain have the same name. There are two types of hosted zones: public hosted zones route traffic on the internet, private hosted zones route traffic within one or more Amazon VPCs.",
    ],
  },
  "create-hosted-zone": {
    title: "Create hosted zone",
    body: [
      "Enter the domain name that you want to route traffic for, choose whether the zone is public or private, and optionally add a description and tags.",
      "Route 53 automatically creates a name server (NS) record and a start of authority (SOA) record for the zone.",
    ],
  },
  "domain-name": {
    title: "Domain name",
    body: [
      "The name of the domain that you want to route traffic for. Use only the characters listed under the field. Labels can be up to 63 characters and the whole name up to 253 characters.",
    ],
  },
  description: { title: "Description", body: ["A value that lets you distinguish hosted zones that have the same name. It can have up to 256 characters."] },
  "hosted-zone-type": {
    title: "Hosted zone type",
    body: [
      "Public hosted zones determine how traffic is routed on the internet.",
      "Private hosted zones determine how traffic is routed within an Amazon VPC.",
    ],
  },
  tags: { title: "Tags", body: ["A tag is a label that you assign to an AWS resource. Each tag has a key and an optional value. You can add up to 50 tags to a hosted zone."] },
  "hosted-zone-details": {
    title: "Hosted zone details",
    body: [
      "The details of the hosted zone include the hosted zone name, ID, description, type, record count, query logging configuration and the four name servers Route 53 assigned to a public hosted zone.",
    ],
  },
  records: {
    title: "Records",
    body: [
      "A record contains information about how you want to route traffic for a domain or subdomain. Select a record to see its details here.",
      "You can't delete the SOA record or the NS record that has the same name as the hosted zone.",
    ],
  },
  "record-name": { title: "Record name", body: ["The name of the record. Keep it blank to create a record for the root domain, or enter a subdomain such as www. The hosted zone name is appended automatically."] },
  "record-type": { title: "Record type", body: ["The DNS type of the record determines the format of the value and what the record is used for."] },
  alias: { title: "Alias", body: ["Alias records route traffic to AWS resources or to another record in the same hosted zone. Alias records have no TTL, and you can only create them for A, AAAA and CNAME types."] },
  value: { title: "Value", body: ["The value that Route 53 returns in response to DNS queries. The format depends on the record type. Enter multiple values on separate lines."] },
  ttl: { title: "TTL (seconds)", body: ["The amount of time, in seconds, that you want DNS recursive resolvers to cache information about this record. Recommended values are between 60 and 172800 (two days)."] },
  "routing-policy": {
    title: "Routing policy",
    body: [
      "The routing policy determines how Route 53 responds to queries. Simple routing returns all values. The other policies need a unique Record ID so Route 53 can tell records with the same name and type apart.",
    ],
  },
  "create-record": {
    title: "Create record",
    body: [
      "Use quick create to add one or more records at once. Use the wizard if you need more explanation, starting with the choice of a routing policy.",
    ],
  },
  "import-zone-file": {
    title: "Import zone file",
    body: [
      "Paste the contents of a BIND-format zone file to create many records at once. The apex NS and SOA records in the file are ignored.",
      "If the hosted zone already contains a record that appears in the zone file, the import fails and no records are created.",
    ],
  },
  "accelerated-recovery": {
    title: "Accelerated recovery",
    body: ["Accelerated recovery lets you continue to make changes to the public DNS records of a hosted zone after an impairment to US East (N. Virginia)."],
  },
  dnssec: {
    title: "DNSSEC signing",
    body: [
      "DNSSEC signing adds cryptographic signatures to the records in a public hosted zone so resolvers can verify that responses were not tampered with.",
      "After you enable signing, you must establish a chain of trust by adding a delegation signer (DS) record to the parent zone.",
    ],
  },
  "query-logging": {
    title: "Query logging",
    body: ["Route 53 can log information about the queries it receives for a public hosted zone, such as the domain or subdomain that was requested, the date and time, and the DNS record type."],
  },
  "test-record": {
    title: "Test record",
    body: [
      "Test record shows how Route 53 responds to DNS queries for a specified record. For geolocation, geoproximity, and latency records, you can also simulate queries from a particular DNS resolver and/or client IP address to find out what response Route 53 would return.",
    ],
    important: [
      "The tool doesn't submit queries to the Domain Name System, it responds based only on the settings in the records in the hosted zone. The tool returns the same information regardless of whether the hosted zone is currently being used to route traffic for the domain.",
    ],
    learnMore: "Checking DNS responses from Route 53",
  },
  dashboard: { title: "Route 53 Dashboard", body: ["The dashboard summarizes your DNS management, availability monitoring, traffic management and domain registration resources."] },
};

export const FALLBACK_HELP: HelpTopic = { title: "Info", body: ["This is a local Route 53 console clone. No additional help is available for this section."] };
