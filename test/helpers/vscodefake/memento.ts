import * as vscode from 'vscode';

export class TestMemento implements vscode.Memento {
    private readonly storage = new Map<string, any>();

    public get<T>(key: string): T | undefined;
    public get<T>(key: string, defaultValue: T): T;
    get<T>(key: string, defaultValue?: T): T | undefined {
        const value = this.storage.get(key) as T | undefined;
        if (value === undefined) {
            return defaultValue;
        }
        return value;
    }
    public update(key: string, value: any): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }
    public containsKey(key: string): boolean {
        return this.storage.hasOwnProperty(key);
    }
    public clear() {
        this.storage.clear();
    }
    // Needed since https://github.com/DefinitelyTyped/DefinitelyTyped/pull/54383/files#diff-0a5f3d01be8ab95a0ca83baa6915417d7497d254e6f0b508447db7388111a2e4R6228-R6234
    public keys(): readonly string[] {
        throw new Error('Method not implemented');
    }
}

export class StateMemento implements vscode.Memento {
    private storage: { [key: string]: any } = {};

    public get<T>(key: string): T | undefined;
    public get<T>(key: string, defaultValue: T): T;
    public get(key: any, defaultValue?: any) {
        if (this.containsKey(key)) {
            return this.storage[key];
        } else {
            return defaultValue;
        }
    }
    public update(key: string, value: any): Thenable<void> {
        return this.storage[key] = value;
    }
    public containsKey(key: string): boolean {
        return this.storage.hasOwnProperty(key);
    }
    public setKeysForSync(_keys: string[]): void {}
    public clear() {
        this.storage = {};
    }
    public keys(): readonly string[] {
        throw new Error('Method not implemented');
    }
}
