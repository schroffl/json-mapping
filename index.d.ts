export type Decoder<T> = {
    readonly __opaque_type: 'decoder'
    readonly __type: T
}

export namespace Decode {
    export const number: Decoder<number>
    export const string: Decoder<string>
    export const integer: Decoder<number>
    export const bool: Decoder<boolean>
    export const unknown: Decoder<unknown>

    export type ObjectLayout<O> = {
        [K in keyof O]?: Decoder<O[K]>
    }

    export function object<O>(layout: ObjectLayout<O>) : Decoder<O>
    export function instance<O>(ctor: new () => O, layout: ObjectLayout<O>) : Decoder<O>
    export function field<T>(name: string, child: Decoder<T>) : Decoder<T>
    export function at<T>(path: string[], child: Decoder<T>) : Decoder<T>

    export function many<T>(child: Decoder<T>) : Decoder<T[]>
    export function map<A, B>(fn: (a: A) => B, child: Decoder<A>) : Decoder<B>
    export function andThen<A, B>(fn: (a: A) => Decoder<B>, child: Decoder<A>) : Decoder<B>
    export function oneOf<T>(decoders: Decoder<T>[]) : Decoder<T>

    export function optional<T>(value: T, child: Decoder<T>) : Decoder<T>
    export function lazy<T>(fn: () => Decoder<T>) : Decoder<T>

    export function succeed<T>(value: T) : Decoder<T>
    export function fail<T>(message: string) : Decoder<T>
}

export function decode<T>(decoder: Decoder<T>, json: any) : T
export function decodeString<T>(decoder: Decoder<T>, json: string) : T
