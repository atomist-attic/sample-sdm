/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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