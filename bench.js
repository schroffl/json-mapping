const bench = require('benchmark');
const suite = new bench.Suite('Primitives');
const { Decode, decode } = require('./index');

class User {}
class Tree {}

// Taken from https://stackoverflow.com/a/43053803
const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

const support = {
    object: Decode.object({
        value: Decode.integer,
    }),
    lazyInteger: Decode.lazy(() => Decode.integer),
    listInteger: Decode.many(Decode.number),
    UserDecoder: Decode.instance(User, {
        id: Decode.field('id', Decode.integer),
        name: Decode.field('name', Decode.string),
    }),
    TreeDecoder: Decode.instance(Tree, {
        value: Decode.field('value', Decode.number),
        child: Decode.field(
            'child',
            Decode.optional(
                null,
                Decode.lazy(() => support.TreeDecoder),
            ),
        ),
    }),
    makeTree: depth => {
        let root = { value: Math.random() };
        let tree = root;

        while (depth-- > 0) {
            tree.child = { value: Math.random() };
            tree = tree.child;
        }

        return root;
    },
    makeList: (size, value) => {
        const arr = new Array(size);
        while (size-- > 0) arr[size] = value;
        return arr;
    },
};

suite
    .add('Decode.unknown', () => {
        return decode(Decode.unknown, 42);
    })
    .add('Decode.string', () => {
        return decode(Decode.string, 'value');
    })
    .add('Decode.number', () => {
        return decode(Decode.number, 42.3);
    })
    .add('Decode.integer', () => {
        return decode(Decode.integer, 42);
    })
    .add('Decode.bool', () => {
        return decode(Decode.bool, true);
    })
    .add('Decode.lazy integer', () => {
        return decode(support.lazyInteger, 42);
    })
    .add('Decode.object simple', () => {
        return decode(support.object, 42);
    })
    .add('Decode.instance User model', () => {
        return decode(support.UserDecoder, {
            id: 42,
            name: 'Yo Bo',
        });
    });

[10, 100, 1000].forEach(depth => {
    const tree = support.makeTree(depth);

    suite.add(`Decode tree (depth: ${depth})`, () => {
        return decode(support.TreeDecoder, tree);
    });
});

cartesian(
    [10, 1000, 100000],
    [
        { name: 'Decode.integer', decoder: Decode.integer, data: 42 },
        { name: 'Decode.string',  decoder: Decode.string, data: '42' },
        {
            name: 'User model',
            decoder: support.UserDecoder,
            data: { id: 42, name: 'Name' },
        },
    ],
).forEach(entry => {
    const size = entry[0];
    const info = entry[1];

    const list = support.makeList(size, info.data);
    const decoder = Decode.many(info.decoder);

    suite.add(`Decode.many (size: ${size}, decoder: ${info.name})`, () => {
        return decode(decoder, list);
    });
});

const args = process.argv.slice(2);
const filter = args.length > 0
    ? args[0].split(',').map(str => str.trim().toLowerCase())
    : [];

suite.filter(bench => {
    if (filter.length === 0) {
        return true;
    }

    const name = bench.name.toLowerCase();
    return filter.some(f => name.includes(f));
}).on('cycle', cycle => {
    const msg = cycle.target.toString();
    console.log(msg);
}).run();
