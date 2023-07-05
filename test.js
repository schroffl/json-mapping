const test = require('ava');
const { Decode, decode, expected, decodeString } = require('./index');

const make = decoder => decode.bind(undefined, decoder);

test('Decode.string', t => {
    const run = make(Decode.string);

    t.is(run('string'), 'string');
    t.throws(() => run(42));
});

test('Decode.number', t => {
    const run = make(Decode.number);

    t.is(run(42), 42);
    t.is(run(42.42), 42.42);
    t.throws(() => run('42'));
    t.throws(() => run(NaN));
});

test('Decode.integer', t => {
    const run = make(Decode.integer);

    t.is(run(42), 42);

    t.is(run(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
    t.is(run(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER);

    t.throws(() => run(42.42));
    t.throws(() => run('42'));
    t.throws(() => run(NaN));
});

test('Decode.bool', t => {
    const run = make(Decode.bool);

    t.is(run(false), false);
    t.is(run(true), true);

    t.throws(() => run(0));
    t.throws(() => run(1));
    t.throws(() => run('true'));
    t.throws(() => run('false'));
    t.throws(() => run(null));
    t.throws(() => run(undefined));
    t.throws(() => run(''));
});

test('Decode.unknown', t => {
    const run = make(Decode.unknown);
    const ref = {};
    const sym = Symbol();

    t.is(run('abc'), 'abc');
    t.is(run(false), false);
    t.is(run(Number.MAX_VALUE), Number.MAX_VALUE);
    t.is(run(ref), ref);
    t.is(run(sym), sym);
});

test('Decode.succeed', t => {
    const run = make(Decode.succeed(42));

    t.is(run(undefined), 42);
    t.is(run(null), 42);
    t.is(run('ababababa'), 42);
    t.is(run({}), 42);
    t.is(run(Symbol()), 42);
    t.is(run(42.2), 42);
    t.is(run(42), 42);
});

test('Decode.fail', t => {
    const run = make(Decode.fail('fail'));

    t.throws(() => run(undefined));
    t.throws(() => run(null));
    t.throws(() => run('ababababa'));
    t.throws(() => run({}));
    t.throws(() => run(Symbol()));
    t.throws(() => run(42.2));
    t.throws(() => run(42));
});

test('Decode.field', t => {
    const run = make(Decode.field('value', Decode.integer));

    t.is(run({ value: 42 }), 42);
    t.is(run({ value: -42 }), -42);

    t.throws(() => run(null));
    t.throws(() => run({ }));
    t.throws(() => run({ value: '42' }));
    t.throws(() => run({ valu: 42 }));
    t.throws(() => run({ value: { value: 42 } }));
});

test('Decode.at', t => {
    const run = make(Decode.at(['a', 'b', 'c', 'd'], Decode.integer));

    t.is(run({a: {b: {c: {d: 42 }}}}), 42);

    t.throws(() => run({a: {b: {c: {e: 42 }}}}));
    t.throws(() => run({a: {b: {c: {d: '42' }}}}));
    t.throws(() => run({a: {d: '42' }}));
});

test('Decode.many', t => {
    const run = make(Decode.many(Decode.integer));

    t.deepEqual(run([]), []);
    t.deepEqual(run([1, 2, 3]), [1, 2, 3]);
    t.throws(() => run(['1', 2, 3]));
    t.throws(() => run({}));
    t.throws(() => run(null));
    t.throws(() => run(undefined));
});

test('Decode.oneOf', t => {
    const string_to_int_decoder = Decode.andThen(str => {
        const v = parseInt(str, 10);

        if (typeof v === 'number' && !isNaN(v) && Math.trunc(v) === v) {
            return Decode.succeed(v);
        } else {
            return Decode.fail(expected('a number string', str));
        }
    }, Decode.string);

    const decoder = Decode.oneOf([
        Decode.integer,
        string_to_int_decoder,
    ]);

    const result = decode(Decode.many(Decode.field('id', decoder)), [
        { id: 1 },
        { id: '2' },
    ]);

    t.deepEqual(result, [1, 2]);

    const failing = Decode.oneOf([
        Decode.integer,
        Decode.string,
    ]);

    t.throws(() => decode(failing, true));
});

test('Decode.andThen', t => {
    const run = make(
        Decode.andThen(
            v => v > 100 ? Decode.succeed('big') : Dec.fail('too small'),
            Decode.integer,
        ),
    );

    t.is(run(101), 'big');
    t.throws(() => run(42));
    t.throws(() => run(100));
    t.throws(() => run('42'));
});

test('Decode.dict', t => {
    const run = make(Decode.dict(Decode.integer));

    const arg = { a: 42, b: 102 };
    const result = run({ a: 42, b: 102 });

    t.not(result, arg); // They should *not* be the same object
    t.deepEqual(result, arg);

    t.throws(() => run({ a: 42, b: 102, c: '3' }));
    t.throws(() => run({ a: 42, b: 102, c: 42.2 }));
    t.throws(() => run('abc'));
    t.throws(() => run(null));
});

test('Decode.object', t => {
    const run = make(Decode.object({ value: Decode.integer }));

    t.deepEqual(run(42), { value: 42 });

    // Nested object
    const run_other = make(
        Decode.object({
            name: Decode.field('name', Decode.string),
            position: Decode.object({
                latitude: Decode.field('lat', Decode.number),
                longitude: Decode.field('lng', Decode.number),
            }),
        }),
    );

    t.deepEqual(
        run_other({
            name: 'Taj Mahal',
            lat: 27.175000,
            lng: 78.041944,
        }),
        {
            name: 'Taj Mahal',
            position: {
                latitude: 27.175000,
                longitude: 78.041944,
            },
        },
    );

    t.throws(() => {
        run_other({
            name: 'abc',
            lat: '27',
            lng: '78',
        });
    });
});

test('Decode.instance', t => {
    class User {
        initials() {
            const parts = this.name.split(' ');
            return parts[0][0] + parts[1][0];
        }
    }

    const UserDecoder = Decode.instance(User, {
        id: Decode.field('id', Decode.integer),
        name: Decode.field('name', Decode.string),
    });

    const user = decode(UserDecoder, { id: 42, name: 'Yo Bo' });

    t.true(user instanceof User);
    t.is(user.initials(), 'YB');

    t.throws(() => decode(UserDecoder, {}));
});

test('Decode.lazy', t => {
    const Tree = class {};
    const Tree_decoder = Decode.instance(Tree, {
        value: Decode.field('value', Decode.integer),
        nodes: Decode.field(
            'nodes',
            Decode.lazy(() => Decode.many(Tree_decoder)),
        ),
    });

    const raw = {
        value: 42,
        nodes: [
            { value: 103, nodes: [] },
            {
                value: 104,
                nodes: [],
            },
        ]
    };

    const tree = decode(Tree_decoder, raw);

    t.is(tree.value, 42);
    t.is(tree.nodes[0].value, 103);
    t.is(tree.nodes[1].value, 104);

    t.true(tree instanceof Tree);
    t.true(tree.nodes[0] instanceof Tree);
    t.true(tree.nodes[1] instanceof Tree);
});

test('Decode.optional', t => {
    const run = make(Decode.optional(42, Decode.integer));

    t.is(run(100), 100);
    t.is(run(-10), -10);
    t.is(run(NaN), 42);
    t.is(run('3'), 42);
    t.is(run(null), 42);
});

test('Decode.map', t => {
    const run = make(Decode.map(n => n * 10, Decode.integer));

    t.is(run(1), 10);
    t.is(run(10), 100);
    t.is(run(0), 0);

    t.throws(() => run('10'));
    t.throws(() => run('0'));
});

test('Decode.optionalField', t => {
    const run = make(Decode.optionalField('field', 0, Decode.integer));

    t.is(run({ field: 42 }), 42);
    t.is(run({}), 0);
    t.throws(() => run({ field: '42' }));
    t.throws(() => run({ field: 42.2 }));
    t.throws(() => run({ field: NaN }));
    t.throws(() => run({ field: undefined }));
});

test('Decode.optionalAt', t => {
    const run = make(Decode.optionalAt(['a', 'b', 'c', 'd'], 0, Decode.integer));

    t.is(run({a: {b: {c: {d: 42 }}}}), 42);
    t.is(run({a: {b: {c: {f: 42 }}}}), 0);
    t.is(run({b: {a: {c: {d: 42 }}}}), 0);
    t.is(run({}), 0);

    t.throws(() => run({a: {b: {c: {d: '42' }}}}));
    t.throws(() => run({a: {b: {c: '42'}}}));
});

test('expected', t => {
    const msg = expected('some type');
    t.true(typeof msg === 'string');
});

// `decodeString` should produce the same result as `decode`.
test('decodeString', t => {
    const cases = [
        { value: true, decoder: Decode.bool },
        { value: 100, decoder: Decode.integer },
        { value: 100.1, decoder: Decode.integer },
        { value: 100.1, decoder: Decode.number },
        { value: { a: 42 }, decoder: Decode.field('a', Decode.integer) },
    ];

    cases.map(caze => {
        const str = JSON.stringify(caze.value);

        return {
            normal: () => decode(caze.decoder, caze.value),
            stringified: () => decodeString(caze.decoder, str),
        };
    }).forEach(caze => {
        let result;

        try {
            result = caze.normal();
        } catch (e) {
            t.throws(caze.stringified);
            return;
        }

        t.deepEqual(caze.stringified(), result);
    });
});
