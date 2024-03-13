/*
 * Copyright (c) 2024 Paradoxum Games
 * This file is licensed under the Mozilla Public License (MPL-2.0). A copy of it is available in the 'LICENSE.txt' file at the root of the repository.
 * This file incorporates code from the "aws4fetch" repository (https://github.com/mhart/aws4fetch). A copy of said code's repository is available in the 'LICENSE.aws4fetch.txt' file at the root of the repository.
 * This file incorporates code from the "Roblo3" repository (https://github.com/Roblo3/Roblo3), which was released to the public domain under no license.
*/

import HashLib from "@rbxts/rbxts-hashlib";

const UNSIGNABLE_HEADERS = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
  "range",
  "connection",
]);

const HttpService = game.GetService("HttpService");

type AwsClientArgs = {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  service?: string;
  region?: string;
  cache?: Map<string, string>;
  retries?: number;
  initRetryMs?: number;
};

type AwsRequestInit = {
  aws: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    service?: string;
    region?: string;
    cache?: Map<string, string>;
    datetime?: LuaTuple<[string, string]>;
    signQuery?: boolean;
    appendSessionToken?: boolean;
    allHeaders?: boolean;
    singleEncode?: boolean;
  };
};

type RequestInit = {
  method: string;
  host: string;
  path: string;
  query: Map<string, string> | Record<string, string>;
  headers: Map<string, string> | Record<string, string>;
  body: string;
};

export class AwsClient {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  service?: string;
  region?: string;
  cache: Map<string, string>;
  retries: number;
  initRetryMs: number;

  constructor({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    retries,
    initRetryMs,
  }: AwsClientArgs) {
    if (accessKeyId === undefined) error("accessKeyId is a required option");
    if (secretAccessKey === undefined)
      error("secretAccessKey is a required option");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || new Map();
    this.retries = retries !== undefined ? retries : 10; // Up to 25.6 secs
    this.initRetryMs = initRetryMs || 50;
  }

  sign(input: RequestInit, init: AwsRequestInit): RequestAsyncRequest {
    const signer = new AwsV4Signer({ ...input, ...init.aws });
    const signed = signer.sign();

    let url = `${input.host}${signed.path}`;
    if (!signed.query.isEmpty()) {
      const params: string[] = [];
      signed.query.forEach((v, k) => {
        params.push(`${k}=${v}`);
      });
      url = `${url}?${params.join("&")}`;
    }

    return {
      Url: url,
      /// XXX: just trust me bro
      Method: signed.method as RequestAsyncRequest["Method"],
      Headers: signed.headers,
      Body: signed.body,
    };
  }

  // TODO: have an exponential backoff request handler here, in the client itself
}

function getTimezoneOffset(ts?: number) {
  const utc_date = os.date("!*t", ts);
  const local_date = os.date("*t", ts);
  local_date.isdst = false;
  return os.difftime(os.time(local_date), os.time(utc_date));
}

function requestTime() {
  const requestTime = os.time() - getTimezoneOffset();
  const datestamp = os.date("%Y%m%d", requestTime);
  const amazonDate = os.date("%Y%m%dT%H%M%SZ", requestTime);
  return $tuple(datestamp, amazonDate);
}

function convertTableToMap(
  input: { [k: string]: string } | Map<string, string>
): Map<string, string> {
  // XXX: hack, if you know a better way to do this, let me know!
  if (input["forEach"] !== undefined) {
    return input as Map<string, string>;
  }

  const entries: [string, string][] = [];
  for (const kv of pairs(input as { [k: string]: string })) {
    const key = kv[0];
    const value = kv[1];
    entries.push([key as string, value]);
  }

  return new Map(entries);
}

type AwsV4SignerArgs = {
  datetime?: LuaTuple<[string, string]>;
  signQuery?: boolean;
  appendSessionToken?: boolean;
  allHeaders?: boolean;
  singleEncode?: boolean;
} & RequestInit &
  AwsRequestInit["aws"];

export class AwsV4Signer {
  method: string;
  path: string;
  query: Map<string, string>;
  headers: Map<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  service: string;
  region: string;
  cache: Map<string, string>;
  datetime: LuaTuple<[string, string]>;
  signQuery?: boolean;
  appendSessionToken?: boolean;
  allHeaders?: boolean;
  singleEncode?: boolean;
  signableHeaders: string[];
  signedHeaders: string;
  canonicalUri: string;
  canonicalQueryString: string;
  canonicalHeaders: string;
  credentialString: string;

  constructor({
    method,
    path,
    query,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    datetime,
    signQuery,
    appendSessionToken,
    allHeaders,
    singleEncode,
  }: AwsV4SignerArgs) {
    if (path === undefined) {
      error("path is a required option");
    }
    if (accessKeyId === undefined) {
      error("accessKeyId is a required option");
    }
    if (secretAccessKey === undefined) {
      error("secretAccessKey is a required option");
    }

    this.method = method || (body ? "POST" : "GET");
    this.path = path;
    this.query = convertTableToMap(query);
    this.headers = convertTableToMap(headers);
    this.body = body || "";
    this.accessKeyId = accessKeyId!;
    this.secretAccessKey = secretAccessKey!;
    this.sessionToken = sessionToken;
    this.service = service || "";
    this.region = region || "us-east-1";
    this.cache = cache || new Map();
    this.datetime = datetime || requestTime();
    this.signQuery = signQuery;
    this.appendSessionToken =
      appendSessionToken || this.service === "iotdevicegateway";

    this.canonicalUri = "/";
    const pathSegments = this.path
      .split("/")
      .map((segment) => uriEncode(uriEncode(segment)))
      .join("");

    this.canonicalUri = `${this.canonicalUri}${pathSegments}`;

    const signableParams: string[] = [];
    this.query.forEach((_, k) => {
      signableParams.push(k);
    });
    signableParams.sort();

    this.canonicalQueryString = signableParams
      .map(
        (param) => `${param}=${uriEncode(this.query.get(param) || "", true)}`
      )
      .join("&");

    const params: Map<string, string> = new Map();
    params.set("X-Amz-Date", this.datetime[1]);
    if (this.sessionToken && !this.appendSessionToken) {
      params.set("X-Amz-Security-Token", this.sessionToken);
    }

    this.signableHeaders = [];
    this.headers.forEach((_, k) => {
      this.signableHeaders.push(k);
    });

    this.signableHeaders = this.signableHeaders
      .filter((header) => allHeaders || !UNSIGNABLE_HEADERS.has(header.lower()))
      .sort();

    this.signedHeaders = this.signableHeaders.join(";");

    // headers are always trimmed:
    // https://fetch.spec.whatwg.org/#concept-header-value-normalize
    this.signableHeaders.sort();
    this.canonicalHeaders = this.signableHeaders
      .map((header) => header + ":" + (this.headers.get(header) || ""))
      .join("\n");

    this.credentialString = [
      this.datetime[0],
      this.region,
      this.service,
      "aws4_request",
    ].join("/");
  }

  sign() {
    if (this.signQuery) {
      this.query.set("X-Amz-Signature", this.signature());
      if (this.sessionToken && this.appendSessionToken) {
        this.query.set("X-Amz-Security-Token", this.sessionToken);
      }
    } else {
      this.headers.set("Authorization", this.authHeader());
    }

    return {
      method: this.method,
      path: this.path,
      query: this.query,
      headers: this.headers,
      body: this.body,
    };
  }

  authHeader() {
    return [
      "AWS4-HMAC-SHA256 Credential=" +
        this.accessKeyId +
        "/" +
        this.credentialString,
      "SignedHeaders=" + this.signedHeaders,
      "Signature=" + this.signature(),
    ].join(", ");
  }

  signature() {
    const date = this.datetime[0];
    const cacheKey = [
      this.secretAccessKey,
      date,
      this.region,
      this.service,
    ].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      const kDate = hmac("AWS4" + this.secretAccessKey, date);
      const kRegion = hmac(kDate, this.region);
      const kService = hmac(kRegion, this.service);
      kCredentials = hmac(kService, "aws4_request");
      this.cache.set(cacheKey, kCredentials);
    }
    // we need the hex digest for this, not the binary string,
    // so we should manually call the hmac function
    return HashLib.hmac(HashLib.sha256, kCredentials, this.stringToSign());
  }

  stringToSign() {
    print(this.canonicalString());
    return [
      "AWS4-HMAC-SHA256",
      this.datetime[0],
      this.credentialString,
      hash(this.canonicalString()),
    ].join("\n");
  }

  canonicalString() {
    return [
      this.method.upper(),
      this.canonicalUri,
      this.canonicalQueryString,
      this.canonicalHeaders,
      this.signedHeaders,
      this.hexBodyHash(),
    ].join("\n");
  }

  hexBodyHash() {
    return HashLib.sha256(this.body);
  }
}

function hmac(key: string, val: string) {
  const signedMessage = HashLib.hmac(HashLib.sha256, key, val);
  const binaryMessage = HashLib.hex_to_bin(signedMessage);
  return binaryMessage;
}

function hash(content: string) {
  return HashLib.sha256(content);
}

function uriEncode(urlEncodedStr: string, doubleEncodeEquals?: boolean) {
  let str = HttpService.UrlEncode(urlEncodedStr);
  str = str.gsub("%%2D", "-")[0];
  str = str.gsub("%%2E", ".")[0];
  str = str.gsub("%%5F", "_")[0];
  str = str.gsub("%%7E", "~")[0];
  if (doubleEncodeEquals) {
    str = str.gsub("%%3D", "%253D")[0];
  }
  return str;
}
