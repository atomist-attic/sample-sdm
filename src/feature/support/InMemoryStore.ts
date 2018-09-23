import { Store } from "../Store";

export class InMemoryStore implements Store {

    private counter = 0;

    private store: { [key: string] : any } = {};

    public load(key: string): Promise<any> {
        return this.store[key];
    }

    public async save(o: any): Promise<string> {
        const key = this.nextKey();
        this.store[key] = o;
        return key;
    }

    private nextKey(): string {
        return `${this.counter++}_key`;
    }

}