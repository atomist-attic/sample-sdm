
export interface Store {

    save(o: any): Promise<string>;

    load(key: string): Promise<any>
}