/**
 * A library for constructing and running decoders that make sure your data
 * looks as expected.
 *
 * This is a tool that is useful for bringing values safely into your code.
 * The source of the data might be something like an HTTP API, user input or
 * localStorage, where you can never be sure that you get what you expect.
 *
 * @packageDocumentation
 */

/**
 * This is intended to be an opaque type.
 * You really shouldn't be building `Decoder<T>` values on your own (because
 * you can't, but TypeScript doesn't stop you). Use the exposed functions
 * for that.
 *
 * If you ever feel like something is missing, please create an issue in the
 * GitHub repository at https://github.com/schroffl/json-mapping
 *
 * @typeParam T - When running this decoder you get a value of this type
 */
export type Decoder<T> = {
    /**
     * @internal
     */
    readonly __opaque_type: 'decoder'

    /**
     * @internal
     */
    readonly __type: T
}

/**
 * Mapped type that creates an object from the given type where every property
 * is optional, but wraps the actual type in a Decoder. It's used by
 * {@link Decode.object} and {@link Decode.instance}.
 *
 * @typeParam O - The type to generate the layout for
 *
 * @example
 * If you had a User model like
 * ```typescript
 * class User {
 *     id: number;
 *     name: string;
 *     children: User[];
 * }
 * ```
 *
 * the mapped layout would look like this:
 *
 * ```typescript
 * type UserLayout = {
 *     id?: Decoder<number>,
 *     name?: Decoder<string>,
 *     children?: Decoder<User[]>,
 *  }
 * ```
 */
export type ObjectLayout<O> = {
    [K in keyof O]?: Decoder<O[K]>
}

/**
 * This namespace wraps all the decoders exposed by this package.
 * It contains primitive decoders like {@link Decode.string} to more
 * complicated ones like {@link Decode.map}.
 * So basically all the building blocks you need for creating decoders for
 * complex data structures.
 */
export namespace Decode {
    /**
     * Decode any valid JavaScript Number that is not NaN
     *
     * @example
     * ```typescript
     * decode(Decode.number, 42.2) == 42.2
     * decode(Decode.number, 42) == 42
     * decode(Decode.number, NaN) // Throws
     * ```
     */
    export const number: Decoder<number>

    /**
     * Decode any string value.
     *
     * @example
     * ```typescript
     * decode(Decode.string, 'abc') === 'abc'
     * decode(Decode.string, 'my-string') === 'my-string'
     * decode(Decode.string, 10) // Throws
     * ```
     */
    export const string: Decoder<string>

    /**
     * Decode an integer. Floating point values are not accepted.
     *
     * @example
     * ```typescript
     * decode(Decode.number, 42) == 42
     * decode(Decode.number, 42.2) // Throws
     * decode(Decode.number, NaN) // Throws
     * ```
     */
    export const integer: Decoder<number>

    /**
     * Decode either `true` or `false`. Nothing else.
     *
     * @example
     * ```typescript
     * decode(Decode.bool, true) === true
     * decode(Decode.bool, false) === false
     * decode(Decode.bool, undefined) // Throws
     * ```
     */
    export const bool: Decoder<boolean>

    /**
     * Decode the value as-is. You probably shouldn't use this, because there's
     * a high chance you're abusing it as an escape-hatch.
     * However, it has a valid use case for building custom decoders with the
     * help of {@link Decode.andThen}. If you do that, please make sure that you keep
     * everything safe.
     *
     * @example
     * ```typescript
     * decode(Decode.unknown, true) === true
     * decode(Decode.unknown, undefined) === undefined
     * decode(Decode.unknown, NaN)
     *
     * // This decoder really blindly passes on the value
     * const symbol = Symbol('my-symbol');
     * decode(Decode.unknown, symbol) === symbol
     * ```
     */
    export const unknown: Decoder<unknown>

    /**
     * Decode the value to an object. This implies nothing about the value that
     * is being decoded, which can be anything.
     * You could take a "plain" integer and "lift" it into an object.
     *
     * @example
     * ```typescript
     * const decoder = Decode.object({
     *     value: Decode.integer,
     * });
     *
     * decode(decoder, 42)    // { value: 42 }
     * decode(decoder, 100)   // { value: 100 }
     * decode(decoder, '100') // Fails
     * ```
     *
     * @param layout - Properties you want the object to have
     */
    export function object<O>(layout: ObjectLayout<O>) : Decoder<O>

    /**
     * Decode an object with arbitrary keys and values of the same type T.
     *
     * @param child - Decoder to use for values
     *
     * @example
     * ```typescript
     * const raw = { en: 'Bread', fr: 'Pain', it: 'Pane' };
     * const decoder = Decode.dict(Decode.string);
     *
     * decode(decoder, raw);         // Works
     *
     * decode(decoder, { en: 128 }); // Fails
     * ```
     */
    export function dict<T>(child: Decoder<T>) : Decoder<{ [key: string]: T }>

    /**
     * This is mostly equivalent to {@link Decode.object}, but it creates an
     * instance of the given class first. You should only use this for simple
     * classes that don't have a complex constructor. Use `map` or `andThen`
     * for complicated cases.
     *
     * @example
     * If you had the following User model in your application
     *
     * ```typescript
     * class User {
     *     id!: number;
     *     name!: string;
     *
     *     get initials(): string {
     *         const parts = this.name.split(' ');
     *         return parts[0][0] + parts[1][0];
     *     }
     * }
     * ```
     *
     * your instance decoder would look like this.
     *
     * ```typescript
     * const UserDecoder = Decode.instance(User, {
     *     id: Decode.field('id', Decode.integer),
     *     name: Decode.field('name', Decode.string),
     * });
     * ```
     *
     * Running this decoder on raw values will ensure that you
     * always have an actual instance of your User class at hand.
     *
     * ```typescript
     * const kobe = decode(UserDecoder, { id: 3, name: 'Kobe Bryant' });
     * console.assert(kobe.id === 3)
     * console.assert(kobe.name === 'Kobe Bryant')
     * console.assert(kobe.initials === 'KB')
     * ```
     *
     * @param ctor - The class you want to construct an instance of
     * @param layout - Properties you want to set on the instance
     *
     * @see object
     * @see ObjectLayout
     */
    export function instance<O>(ctor: new () => O, layout: ObjectLayout<O>) : Decoder<O>

    /**
     * Access the given property of an object.
     *
     * @param name - Name of the property
     * @param child - The decoder to run on the value of that property
     *
     * @example
     * ```typescript
     * const decoder = Decode.field('value', Decode.integer);
     *
     * decode(decoder, { value: 42 }) === 42
     * decode(decoder, {}) // Fails
     * decode(decoder, 42) // Fails
     * ```
     */
    export function field<T>(name: string, child: Decoder<T>) : Decoder<T>

    /**
     * Same as {@link Decode.field}, but it doesn't fail when the property is not
     * present on the object. In that case, the provided value is returned.
     *
     * @param name - Name of the property
     * @param value - The value to use if the field is absent
     * @param child - The decoder to run on the value of that property
     *
     * @example
     * ```typescript
     * const decoder = Decode.optionalField('value', 100, Decode.integer);
     *
     * decode(decoder, { value: 42 }) === 42
     * decode(decoder, {}) === 100
     * decode(decoder, 42) // Fails
     * ```
     */
    export function optionalField<T>(name: string, value: T, child: Decoder<T>) : Decoder<T>

    /**
     * It's basically the same as {@link Decode.field}, but makes it easier
     * to define deep property paths.
     * Instead of `Decode.field('outer', Decode.field('inner', Decode.string))`
     * you can use `Decode.at(['outer', 'inner'], Decode.string)`
     *
     * @param path - The property path to follow. The first name is the
     *               outer-most field
     * @param child - The decoder to run on that field
     *
     * @example
     * When you want to access the `name` field in an object like this
     * ```json
     * {
     *     "data": {
     *         "outer": {
     *             "inner": {
     *                 "name": "Kobe Bryant",
     *             },
     *         },
     *     },
     * }
     * ```
     *
     * you would have to chain quite a few {@link Decode.field | field}
     * decoders, which is annoying.
     *
     * ```typescript
     * const decoder = Decode.field(
     *     'data',
     *     Decode.field(
     *         'outer',
     *         Decode.field(
     *             'inner',
     *             Decode.field(
     *                 'name',
     *                 Decode.string,
     *             ),
     *         ),
     *     ),
     * );
     *
     * decode(decoder, raw) === 'Kobe Bryant'
     * ```
     *
     * {@link Decode.at} allows us to be more concise.
     *
     * ```typescript
     * const short = Decode.at(['data', 'outer', 'inner', 'name'], Decode.string);
     * decode(short, raw) === 'Kobe Bryant'
     * ```
     */
    export function at<T>(path: string[], child: Decoder<T>) : Decoder<T>

    /**
     * This is the same as {@link Decode.at}, but implemented in terms of
     * {@link Decode.optionalField} instead of {@link Decode.field}.
     * This means that the provided value is returned if any object in the
     * given path is missing the next property.
     *
     * @param path - The property path to follow. The first name is the
     *               outer-most field
     * @param value - The value to use if any field is absent
     * @param child - The decoder to run on that field
     *
     * @example
     * ```typescript
     * const decoder = Decode.optionalAt(['outer', 'inner', 'value'], 100, Decode.integer);
     *
     * decode(decoder, { outer: { inner: { value: 42 } } }) === 42
     * decode(decoder, { outer: { inner: { } } }) === 100
     * decode(decoder, { outer: { } }) === 100
     * decode(decoder, {}) === 100
     * decode(decoder, 42) // Fails
     * decode(decoder, { outer: 42 }) // Fails
     * decode(decoder, { outer: { inner: 42 } }) // Fails
     * ```
     */
    export function optionalAt<T>(name: string, value: T, child: Decoder<T>) : Decoder<T>

    /**
     * Make a decoder that can be used for decoding arrays, where
     * every value is run through the given child decoder.
     *
     * @param child - Decoder for array items
     *
     * @example
     * Suppose we have a decoder for Users
     * ```typescript
     * class User {}
     *
     * const user_decoder = Decode.instance(User, {
     *     id: Decode.field('id', Decode.integer),
     *     name: Decode.field('name', Decode.string),
     * });
     * ```
     *
     * Using {@link Decode.many} we can easily build a decoder for a list of users:
     *
     * ```typescript
     * const decoder = Decode.many(user_decoder);
     *
     * decode(decoder, [ {id: 1, name: 'Jeff'}, {id: 2, name: 'Jake'} ]);
     * ```
     *
     * @returns Decoder for an array of things
     */
    export function many<T>(child: Decoder<T>) : Decoder<T[]>

    /**
     * Take the value decoded by the given decoder and transform it.
     *
     * @param fn - Your mapping function
     * @param child - The decoder to run before calling your function
     *
     * @typeParam A - Input to the mapping function
     * @typeParam B - The mapping function returns a value of this type
     *
     * @example
     * ```typescript
     * // Add 42 to a number
     * const add_42_decoder = Decode.map(value => value + 42, Decode.number);
     *
     * decode(add_42_decoder, 0) === 42
     * decode(add_42_decoder, -42) === 0
     * decode(add_42_decoder, 42) === 84
     * decode(add_42_decoder, 'text') // Fails
     *
     * // Convert any value to its string representation.
     * const to_string_decoder = Decode.map(value => String(value), Decode.unknown);
     *
     * decode(to_string_decoder, 42) === '42'
     * decode(to_string_decoder, {}) === '[object Object]'
     * decode(to_string_decoder, 'text') === 'text'
     * decode(to_string_decoder, Symbol('my_symbol')) === 'Symbol(my_symbol)'
     * ```
     */
    export function map<A, B>(fn: (a: A) => B, child: Decoder<A>) : Decoder<B>

    /**
     * Similar to {@link Decode.map}, but you return a decoder instead of a
     * value.
     * This allows you to decide how to continue decoding depending on the
     * result.
     *
     * @param fn - Mapping function that returns a decoder
     * @param child - The decoder to run before the mapping function
     *
     * @typeParam A - Input to the mapping function
     * @typeParam B - The mapping function returns a decoder for this type
     *
     * @example
     * Maybe our HTTP API of choice wraps the data in an object that contains
     * information about the success of the operation.
     * Depending on that value we want to handle the data differently.
     *
     * ```typescript
     * const UserDecoder = Decode.object({
     *     id: Decode.field('id', Decode.integer),
     *     name: Decode.field('name', Decode.string),
     * });
     *
     * const response_decoder = Decode.andThen(
     *     success => {
     *         if (success) {
     *             return Decode.field('data', UserDecoder);
     *         } else {
     *             return Decode.andThen(
     *                 error => Decode.fail('Got an error response: ' + error),
     *                 Decode.field('error', Decode.string),
     *             );
     *         }
     *     },
     *     Decode.field('success', Decode.bool),
     * );
     *
     * // Works
     * decode(response_decoder, {
     *     success: true,
     *     data: {
     *         id: 1,
     *         name: 'Kobe Bryant',
     *     },
     * });
     *
     * // Fails
     * decode(response_decoder, {
     *     success: false,
     *     error: 'Could not find user!',
     * });
     * ```
     *
     * This is nice and all, but it only works for the UserDecoder.
     * However, making it generic is rather simple. You just wrap the Decoder
     * in a function and accept the data decoder as an argument:
     *
     * ```typescript
     * function responseDecoder<T>(child: Decoder<T>): Decoder<T> {
     *     return Decode.andThen(success => {
     *         if (success) {
     *             return Decode.field('data', child);
     *         } else {
     *             // etc.
     *         }
     *     }, Decode.field('success', Decode.boolean');
     * }
     * ```
     */
    export function andThen<A, B>(fn: (a: A) => Decoder<B>, child: Decoder<A>) : Decoder<B>

    /**
     * Combine multiple decoders where any of them can match for the resulting
     * decoder to succeed.
     *
     * @param decoders - A list of decoders that will be executed
     *
     * @example
     * For this example we assume that we have an API endpoint that returns
     * either a numeric string or a number. Something like this:
     *
     * ```json
     * [
     *     { id: 1 },
     *     { id: '2' },
     * ]
     * ```
     *
     * which can be decoded to a flat numeric array like this:
     *
     * ```typescript
     * const string_to_number_decoder = Decode.andThen(str => {
     *     const v = parseInt(str, 10);
     *
     *     if (typeof v === 'number' && !isNaN(v)) {
     *         return Decode.succeed(v);
     *     } else {
     *         return Decode.fail(expected('a number string', str));
     *     }
     * }, Decode.string);
     *
     * const decoder = Decode.oneOf([
     *     Decode.number,
     *     string_to_number_decoder,
     * ]);
     *
     * // This gives us an array like [1, 2], where both values are actual
     * // numbers
     * decode(Decode.many(Decode.field('id', decoder)), [
     *     { id: 1 },
     *     { id: '2' },
     * ]);
     * ```
     */
    export function oneOf<T>(decoders: Decoder<T>[]) : Decoder<T>

    /**
     * If the decoder fails, the given value is returned instead.
     *
     * @example
     * ```typescript
     * const decoder = Decode.optional(42, Decode.number);
     *
     * decode(decoder, 100) === 100
     * decode(decoder, -10) === -10
     *
     * decode(decoder, '3') === 42
     * decode(decoder, NaN) === 42
     * decode(decoder, null) === 42
     * ```
     *
     * @remarks This is implemented by using {@link Decode.oneOf}:
     * ```typescript
     * function optional(value, child) {
     *     return Decode.oneOf([ child, Decode.succeed(value) ]);
     * }
     * ```
     */
    export function optional<T>(value: T, child: Decoder<T>) : Decoder<T>

    /**
     * Make decoder that runs the given function and uses its result for
     * decoding.
     * This can be used for nested decoding, where you would otherwise get a
     * `Cannot access 'value' before initialization` error.
     *
     * @param fn - Function that returns the actual decoder
     *
     * @example
     * ```typescript
     * class Tree {}
     *
     * const tree_decoder = Decode.instance(Tree, {
     *     value: Decode.field('value', Decode.integer),
     *     children: Decode.field(
     *         'children',
     *         Decode.lazy(() => Decode.many(tree_decoder)),
     *     ),
     * });
     *
     * const raw = {
     *     value: 42,
     *     children: [
     *         { value: 43, children: [] },
     *         {
     *             value: 44,
     *             children: [
     *                 { value: 45, children: [] },
     *             ],
     *         },
     *     ]
     * };
     *
     * decode(tree_decoder, raw) // Decodes the nested tree structure
     * ```
     *
     * @returns A decoder that calls the given function when its executed. The
     *          returned value is what will then be used for decoding.
     */
    export function lazy<T>(fn: () => Decoder<T>) : Decoder<T>

    /**
     * Make a decoder that *always* succeeds with the given value.
     * The input is basically ignored.
     *
     * @param value - The returned value
     *
     * @example
     * ```typescript
     * const decoder = Decode.succeed(42);
     *
     * decode(decoder, 'string') === 42
     * decode(decoder, {}) === 42
     * decode(decoder, null) === 42
     * decode(decoder, 42) === 42
     * ```
     *
     * @returns A decoder that always succeeds with the given value when executed
     */
    export function succeed<T>(value: T) : Decoder<T>

    /**
     * Make a decoder that *never* succeeds and fails with the given message.
     * This is mostly useful for building custom decoders with `andThen`.
     *
     * @param message - Custom error message
     *
     * @example
     * This example uses {@link expected} to create the error message.
     *
     * ```typescript
     * const base64_decoder = Decode.andThen(str => {
     *     try {
     *         return Decode.succeed(atob(str));
     *     } catch {
     *         return Decode.fail(expected('a valid base64 string', str));
     *     }
     * }, Decode.string);
     *
     * decode(base64_decoder, 'SGVsbG8sIFdvcmxkIQ==') === 'Hello, World!'
     * decode(base64_decoder, 'invalid$') // Throws
     * ```
     *
     * @returns A decoder that always fails when executed
     */
    export function fail<T>(message: string) : Decoder<T>
}

/**
 * Run the given decoder on the given input.
 *
 * @param decoder - The decoder to use
 * @param json - The unknown value you want to decode
 *
 * @typeParam T - The result type of the decoder and also return type
 *                of the function
 *
 * @throws If any decoder causes an error this function will throw it
 * @returns The value as advertised by the decoder
 */
export function decode<T>(decoder: Decoder<T>, json: any) : T

/**
 * This is the same as {@link decode}, but it accepts a JSON string instead of
 * a JavaScript value.
 *
 * @param decoder - The decoder to use
 * @param json - The JSON string
 *
 * @see decode
 */
export function decodeString<T>(decoder: Decoder<T>, json: string) : T

/**
 * Useful for building error messages for your own little decoders.
 * Since this function is used internally, the message layout will be the same,
 * which makes it easier for humans to parse error messages. Especially when
 * decoding complex values.
 *
 * @param description - Describe what kind of value you expected
 * @param value - Whatever value you got instead
 *
 * @returns A nicely formatted error string
 */
export function expected(description: string, value: any) : string
