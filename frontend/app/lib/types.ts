export type Tag = { key: string; value: string };

export type DnssecInfo = {
  enabled: boolean;
  status: "Signing" | "Not signing";
  keys: { name: string; status: string; created_at: string | null }[];
};

export type Zone = {
  id: string;
  name: string;
  comment: string;
  private_zone: boolean;
  vpc_region: string;
  vpc_id: string;
  created_at: string;
  record_count: number;
  tags: Tag[];
  name_servers: string[];
  query_log_group: string;
  accelerated_recovery: boolean;
  dnssec: DnssecInfo;
};

export type DnsRecord = {
  id: number;
  zone_id: string;
  name: string;
  type: string;
  value: string;
  ttl: number;
  routing_policy: string;
  alias: boolean;
  evaluate_target_health: boolean;
  set_identifier: string;
  protected: boolean;
};

export type RecordInput = {
  name: string;
  type: string;
  value: string;
  ttl: number;
  routing_policy: string;
  alias: boolean;
  evaluate_target_health: boolean;
  set_identifier: string;
};

export type SearchResult = {
  kind: "Hosted zone" | "Record";
  label: string;
  detail: string;
  zone_id: string;
  record_id?: number;
};

export type ImportPreview = {
  records: { name: string; type: string; value: string; ttl: number }[];
  conflicts: string[];
  error: string | null;
};

export type TestRecordResult = {
  response_code: "NOERROR" | "NXDOMAIN";
  protocol: string;
  record_name: string;
  record_type: string;
  resolver_ip: string;
  ttl: number | null;
  values: string[];
};
