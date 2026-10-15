// The Telegram bridge's native side (src-tauri/src/telegram): the bot token is set write-only and
// read in Rust; polling, pairing and sending happen there. Only paired users' updates arrive here.

import { Channel, invoke } from '@tauri-apps/api/core';

export const TELEGRAM_TOKEN_REF = 'telegram.botToken';

export interface TgUser {
  userId: number;
  chatId: number;
  name: string;
  /** owner (the first one paired) · user */
  role: string;
  pairedAt: number;
}

export interface TgFile {
  fileId: string;
  /** document · photo · voice · audio · video */
  kind: string;
  name?: string;
  mime?: string;
  size?: number;
}

export type TgEvent =
  | { t: 'message'; chatId: number; userId: number; messageId: number; text?: string; file?: TgFile }
  | { t: 'callback'; id: string; chatId: number; userId: number; messageId: number; data: string }
  | { t: 'paired'; user: TgUser }
  | { t: 'status'; running: boolean; error?: string };

export interface TgStatus {
  hasToken: boolean;
  running: boolean;
  bot?: string;
  error?: string;
  users: TgUser[];
  pairingUntil?: number;
}

export interface TgButton {
  text: string;
  /** at most 64 bytes */
  data: string;
}

/** what the file store answered for a downloaded file */
export interface TgStored {
  storageRef: string;
  sha256: string;
  size: number;
  mime?: string;
  text: boolean;
}

export interface TelegramTransport {
  readonly available: boolean;
  setToken(token: string): Promise<void>;
  status(): Promise<TgStatus>;
  verify(): Promise<string>;
  start(onEvent: (e: TgEvent) => void): Promise<void>;
  stop(): Promise<void>;
  pairBegin(): Promise<{ code: string; expiresAt: number }>;
  pairCancel(): Promise<void>;
  removeUser(userId: number): Promise<boolean>;
  disconnect(): Promise<void>;
  /** html: Telegram HTML (<b> <i> <code> <pre> <a> <blockquote>); Rust resends as plain text if Telegram cannot parse it */
  send(chatId: number, text: string, buttons?: TgButton[][], html?: boolean): Promise<number>;
  edit(chatId: number, messageId: number, text: string, buttons?: TgButton[][], html?: boolean): Promise<void>;
  /** a picture from the file store, with an optional caption and buttons */
  sendPhoto(chatId: number, storageRef: string, caption?: string, buttons?: TgButton[][], html?: boolean): Promise<number>;
  answer(callbackId: string, text?: string): Promise<void>;
  typing(chatId: number): Promise<void>;
  sendDocument(chatId: number, storageRef: string, name: string, caption?: string): Promise<number>;
  fetchFile(fileId: string): Promise<TgStored>;
}

export class TauriTelegramTransport implements TelegramTransport {
  readonly available = true;
  setToken(token: string) {
    return invoke<void>('secret_set', { name: TELEGRAM_TOKEN_REF, value: token.trim() });
  }
  status() {
    return invoke<TgStatus>('telegram_status');
  }
  verify() {
    return invoke<string>('telegram_verify');
  }
  start(onEvent: (e: TgEvent) => void) {
    const ch = new Channel<TgEvent>();
    ch.onmessage = onEvent;
    return invoke<void>('telegram_start', { onEvent: ch });
  }
  stop() {
    return invoke<void>('telegram_stop');
  }
  pairBegin() {
    return invoke<{ code: string; expiresAt: number }>('telegram_pair_begin');
  }
  pairCancel() {
    return invoke<void>('telegram_pair_cancel');
  }
  removeUser(userId: number) {
    return invoke<boolean>('telegram_remove_user', { userId });
  }
  disconnect() {
    return invoke<void>('telegram_disconnect');
  }
  send(chatId: number, text: string, buttons?: TgButton[][], html?: boolean) {
    return invoke<number>('telegram_send', { chatId, text, buttons: buttons ?? null, html: html ?? false });
  }
  edit(chatId: number, messageId: number, text: string, buttons?: TgButton[][], html?: boolean) {
    return invoke<void>('telegram_edit', { chatId, messageId, text, buttons: buttons ?? null, html: html ?? false });
  }
  sendPhoto(chatId: number, storageRef: string, caption?: string, buttons?: TgButton[][], html?: boolean) {
    return invoke<number>('telegram_send_photo', { chatId, storageRef, caption: caption ?? null, buttons: buttons ?? null, html: html ?? false });
  }
  answer(callbackId: string, text?: string) {
    return invoke<void>('telegram_answer', { callbackId, text: text ?? null });
  }
  typing(chatId: number) {
    return invoke<void>('telegram_typing', { chatId });
  }
  sendDocument(chatId: number, storageRef: string, name: string, caption?: string) {
    return invoke<number>('telegram_send_document', { chatId, storageRef, name, caption: caption ?? null });
  }
  fetchFile(fileId: string) {
    return invoke<TgStored>('telegram_fetch_file', { fileId });
  }
}

/** browser builds: no bot (the token needs the OS credential store) */
export class UnavailableTelegramTransport implements TelegramTransport {
  readonly available = false;
  private no = async (): Promise<never> => {
    throw new Error('Telegram works in the RealmNest desktop app only.');
  };
  setToken = this.no;
  async status(): Promise<TgStatus> {
    return { hasToken: false, running: false, users: [] };
  }
  verify = this.no;
  start = this.no;
  async stop() {}
  pairBegin = this.no;
  async pairCancel() {}
  async removeUser() {
    return false;
  }
  async disconnect() {}
  send = this.no;
  edit = this.no;
  sendPhoto = this.no;
  async answer() {}
  async typing() {}
  sendDocument = this.no;
  fetchFile = this.no;
}
