import { wrap, setSessionId } from "@tenet-voice/sdk";

interface TenetLLMOptions {
  tenetKey: string;
  llm: any;
  failover?: boolean;
  proxyUrl?: string;
}

export class TenetLLM {
  readonly tenetKey: string;
  private _innerLLM: any;
  private _wrapped = false;
  private _sessionId?: string;
  private _roomName?: string;
  private _roomSid?: string;
  private _failover: boolean;
  private _proxyUrl: string;

  constructor(opts: TenetLLMOptions) {
    this.tenetKey = opts.tenetKey;
    this._innerLLM = opts.llm;
    this._failover = opts.failover ?? true;
    this._proxyUrl = opts.proxyUrl ?? "https://inference.trytenet.ai";
  }

  get sessionId() { return this._sessionId; }
  get roomName() { return this._roomName; }
  get roomSid() { return this._roomSid; }

  setParticipant(participant: { identity: string }) {
    this._sessionId = participant.identity;
    if (this._wrapped && this._innerLLM._client) {
      setSessionId(this._innerLLM._client, this._sessionId);
    }
  }

  setRoom(room: { name: string; sid: string }) {
    this._roomName = room.name;
    this._roomSid = room.sid;
  }

  private ensureWrapped() {
    if (this._wrapped) return;
    const client = this._innerLLM._client;
    if (client) {
      wrap(client, {
        tenetKey: this.tenetKey,
        failover: this._failover,
        proxyUrl: this._proxyUrl,
      });
    }
    this._wrapped = true;
  }

  async chat(...args: any[]) {
    this.ensureWrapped();
    return this._innerLLM.chat(...args);
  }
}
