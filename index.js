// The export pattern is a UMD template:
// https://github.com/umdjs/umd/blob/1deb860078252f31ced62fa8e7694f8bbfa6d889/templates/returnExports.js
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.JsonMapping = factory();
    }
}(this, function () {
    var Decode = {};

    var STRING = 0;
    var NUMBER = 1;
    var INTEGER = 3;
    var BOOL = 4;

    var FIELD = 5;
    var OBJECT = 6;
    var INSTANCE = 7;

    var MAP = 8;
    var AND_THEN = 9;
    var LAZY = 10;
    var MANY = 11;

    var SUCCEED = 12;
    var FAIL = 13;
    var ONE_OF = 14;

    /**
     * The 'ok' and 'error' wrappers only exist for performance reasons.
     * Previously I had an implementation that threw immediately when
     * a decoder failed, but that had a hefty impact on the performance
     * of Decode.oneOf, because it expects some of it's child decoders
     * to fail.
     *
     * Now we have a separate decodeInternal function which uses the
     * result wrappers and a user-exposed decode function which throws
     * if the decoder fails.
     */

    function ok(value) {
        return { ok: true, value: value };
    }

    function isOk(result) {
        return result.ok === true;
    }

    function err(msg) {
        return { ok: false, msg: msg };
    }

    function toDebugString(value) {
        var str = '\n' + JSON.stringify(value, null, 4);
        return str.replace(/\n/g, '\n    ') + '\n';
    }

    function expected(type, value) {
        return 'Expected ' + type + ', but got\n' + toDebugString(value);
    }

    function decode(decoder, value) {
        var result = decodeInternal(decoder, value, value);

        if (isOk(result)) {
            return result.value;
        } else {
            throw new Error(result.msg);
        }
    }

    function decodeInternal(decoder, value, _obj_context) {
        switch (decoder.tag) {
            case NUMBER:
                if (typeof value !== 'number') {
                    return err(expected('a number', value));
                } else {
                    return ok(value);
                }

            case INTEGER:
                if (typeof value !== 'number' || (value | 0) !== value) {
                    return err(expected('an integer', value));
                } else {
                    return ok(value);
                }

            case STRING:
                if (typeof value !== 'string') {
                    return err(expected('a string', value));
                } else {
                    return ok(value);
                }

            case FIELD: {
                if (typeof _obj_context !== 'object' || _obj_context === null || !(decoder.key in _obj_context)) {
                    return err(expected('an object with a field named \'' + decoder.key + '\'', _obj_context));
                } else {
                    return decodeInternal(decoder.child, _obj_context[decoder.key]);
                }
            }

            case BOOL:
                if (typeof value !== 'boolean') {
                    return err(expected('a boolean', value));
                } else {
                    return ok(value);
                }

            case SUCCEED:
                return ok(decoder.value);

            case FAIL:
                return err(decoder.message);

            case LAZY:
                var child = decoder.fn();
                return decodeInternal(child, value, _obj_context);

            case MAP: {
                var result = decodeInternal(decoder.child, value, _obj_context);

                if (isOk(result)) {
                    return ok(decoder.fn(result.value));
                } else {
                    return result;
                }
            }

            case AND_THEN: {
                var result = decodeInternal(decoder.child, value, _obj_context);

                if (isOk(result)) {
                    return decodeInternal(decoder.fn(result.value), value, _obj_context);
                } else {
                    return result;
                }
            }

            case MANY: {
                var arr = new Array(value.length);

                if (!Array.isArray(value)) {
                    return err(expected('an array', value));
                }

                for (var i=0; i<value.length; i++) {
                    var result = decodeInternal(decoder.child, value[i]);

                    if (isOk(result)) {
                        arr[i] = result.value;
                    } else {
                        return result;
                    }
                }

                return ok(arr);
            }

            case OBJECT:
                return decodeObj(decoder.layout, {}, value);

            case INSTANCE:
                var inst = new decoder.ctor();
                return decodeObj(decoder.layout, inst, value);

            case ONE_OF: {
                var decs = decoder.decoders;

                for (var i=0; i<decs.length; i++) {
                    var result = decodeInternal(decs[i], value, _obj_context);

                    if (isOk(result)) {
                        return result;
                    }
                }

                return err('No oneOf decoder matched');
            }
        }
    }

    function decodeObj(layout, obj, value) {
        for (var key in layout) {
            var child = layout[key],
                result = decodeInternal(child, value[key], value);

            if (isOk(result)) {
                obj[key] = result.value;
            } else {
                return result;
            }
        }

        return ok(obj);
    }

    Decode.field = function(key, child) {
        return { tag: FIELD, key: key, child: child };
    };

    Decode.string = { tag: STRING };
    Decode.number = { tag: NUMBER };
    Decode.integer = { tag: INTEGER };
    Decode.bool = { tag: BOOL };

    Decode.object = function(layout) {
        return { tag: OBJECT, layout: layout };
    };

    Decode.instance = function(ctor, layout) {
        return { tag: INSTANCE, ctor: ctor, layout: layout };
    };

    Decode.lazy = function(fn) {
        return { tag: LAZY, fn: fn };
    };

    Decode.many = function(child) {
        return { tag: MANY, child: child };
    };

    Decode.andThen = function(fn, child) {
        return { tag: AND_THEN, child: child, fn: fn };
    };

    Decode.map = function(fn, child) {
        return { tag: MAP, child: child, fn: fn };
    };

    Decode.succeed = function(value) {
        return { tag: SUCCEED, value: value };
    };

    Decode.fail = function(message) {
        return { tag: FAIL, message: message };
    };

    Decode.oneOf = function(decoders) {
        return { tag: ONE_OF, decoders: decoders };
    };

    Decode.optional = function(val, child) {
        return Decode.oneOf([
            child,
            Decode.succeed(val)
        ]);
    };

    return {
        Decode: Decode,

        decode: decode,
        decodeString: function(decoder, str) {
            var val = JSON.parse(str);
            return decode(decoder, val);
        }
    };
}));
