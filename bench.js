const bench = require('benchmark');
const suite = new bench.Suite('Primitives');
const { Decode, decode } = require('./index');

class User {}
class Tree {}

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
    makeList: size => {
        const arr = new Array(size);
        while (size-- > 0) arr[size] = Math.random();
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

[10, 1000, 100000].forEach(size => {
    const list = support.makeList(size);

    suite.add(`Decode.many integer (size: ${size})`, () => {
        return decode(support.listInteger, list);
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

