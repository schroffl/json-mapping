// The export pattern is a UMD template:
// https://github.com/umdjs/umd/blob/1deb860078252f31ced62fa8e7694f8bbfa6d889/templates/returnExports.js
(function (root, factory) {
    /* c8 ignore start */
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
    /* c8 ignore stop */
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

    var UNKNOWN = 15;

    var DICT = 16;

    var FIELD_ERROR_META = 999;

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

    function err(msg, meta) {
        return { ok: false, msg: msg, meta: meta };
    }

    /* c8 ignore start */
    function debugReplace(key, value) {
        if (key === '') {
            return value;
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                return value;
            } else if (value.length === 1) {
                return '<Array with a single item>';
            } else {
                return '<Array with ' + value.length + ' items>';
            }
        } else if (typeof value === 'object' && value !== null) {
            var fieldStr = '', fieldCount = 0;

            for (var key in value) {
                if (fieldCount === 3) {
                    fieldStr += ', ...';
                } else if (fieldCount < 3) {
                    fieldStr += fieldCount === 0 ? '' : ', ';
                    fieldStr += '\'' + key + '\'';
                }

                fieldCount++;
            }

            if (fieldCount === 0) {
                return value;
            } else if (fieldCount === 1) {
                return '<Object with the field ' + fieldStr + '>';
            } else if (fieldCount <= 4) {
                return '<Object with these fields: ' + fieldStr + '>';
            } else {
                return '<Object with ' + fieldCount + ' fields, like ' + fieldStr + '>';
            }
        } else {
            return value;
        }
    }
    /* c8 ignore stop */

    function toDebugString(value) {
        var str = '\n' + JSON.stringify(value, debugReplace, 4);
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

    function decodeInternal(decoder, value) {
        switch (decoder.tag) {
            case NUMBER:
                if (typeof value !== 'number' || isNaN(value)) {
                    return err(expected('a number', value));
                } else {
                    return ok(value);
                }

            case INTEGER:
                if (typeof value !== 'number' || Math.trunc(value) !== value) {
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
                if (typeof value !== 'object' || value === null) {
                    return err(expected('an object with a field named \'' + decoder.key + '\'', value));
                } else if (!(decoder.key in value)) {
                    if ('otherwise' in decoder) {
                        return ok(decoder.otherwise);
                    }

                    return err(expected('an object with a field named \'' + decoder.key + '\'', value));
                } else {
                    var result = decodeInternal(decoder.child, value[decoder.key]);

                    if (isOk(result)) {
                        return result;
                    } else {
                        var msg = result.msg;
                        msg += '\nwhen attempting to decode the field \'' + decoder.key + '\' of\n' + toDebugString(value);
                        return err(msg, result.meta);
                    }
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
                return decodeInternal(child, value);

            case MAP: {
                var result = decodeInternal(decoder.child, value);

                if (isOk(result)) {
                    return ok(decoder.fn(result.value));
                } else {
                    return result;
                }
            }

            case AND_THEN: {
                var result = decodeInternal(decoder.child, value);

                if (isOk(result)) {
                    return decodeInternal(decoder.fn(result.value), value);
                } else {
                    return result;
                }
            }

            case MANY: {
                if (!Array.isArray(value)) {
                    return err(expected('an array', value));
                }
                
                var arr = new Array(value.length);

                for (var i=0; i<value.length; i++) {
                    var result = decodeInternal(decoder.child, value[i]);

                    if (isOk(result)) {
                        arr[i] = result.value;
                    } else {
                        var msg = result.msg;
                        msg += '\nwhen attempting to decode the item at index ' + i + ' of\n' + toDebugString(value);
                        return err(msg, result.meta);
                    }
                }

                return ok(arr);
            }

            case OBJECT:
                return decodeObj(decoder.layout, {}, value);

            case INSTANCE:
                return decodeObj(decoder.layout, new decoder.ctor(), value);

            case ONE_OF: {
                var decs = decoder.decoders;
                var errs = new Array(decs.length);

                for (var i=0; i<decs.length; i++) {
                    var result = decodeInternal(decs[i], value);

                    if (isOk(result)) {
                        return result;
                    } else {
                        errs[i] = result;
                    }
                }

                var str = 'oneOf failed, because none of its child decoders were successful in decoding the value, here is a list of all errors:\n\n';

                for (var err_i = 0; err_i < errs.length; err_i++) {
                    var error = errs[err_i];

                    str += err_i === 0 ? '┌' : '├';
                    str += '── Decoder at index ' + err_i + ' reported:\n│\n│';
                    str += ('\n' + error.msg).replace(/\n/g, '\n│    ') + '\n│';

                    if (err_i < errs.length - 1) {
                        str += '\n│\n';
                    }
                }

                return err(str + '\n┴\n');
            }

            case UNKNOWN: {
                return ok(value);
            }

            case DICT: {
                if (typeof value !== 'object' || value === null) {
                    return err(expected('an object', value));
                } else {
                    var result = {};

                    for (var key in value) {
                        var child_value = decodeInternal(decoder.child, value[key]);

                        if (isOk(child_value)) {
                            result[key] = child_value.value;
                        } else {
                            // TODO Wrap in key info
                            return child_value;
                        }
                    }

                    return ok(result);
                }
            }
        }
    }

    function decodeObj(layout, obj, value) {
        for (var key in layout) {
            var child = layout[key],
                result = decodeInternal(child, value);

            if (isOk(result)) {
                obj[key] = result.value;
            } else {
                if (result.meta !== FIELD_ERROR_META) {
                    var msg = 'Did you forget to wrap your decoder in \'Decode.field\'?'
                    msg += ' This is not done automatically for you when using \'Decode.object\' or \'Decode.instance\'. Here\'s the actual error: ';
                    msg += result.msg;

                    return err(msg, FIELD_ERROR_META);
                }

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

    Decode.at = function(path, child) {
        var dec = child, i = path.length;

        while (i-- > 0) {
            dec = Decode.field(path[i], dec);
        }

        return dec;
    };

    Decode.unknown = { tag: UNKNOWN };

    Decode.dict = function(child) {
        return { tag: DICT, child: child };
    };

    Decode.optionalField = function(key, val, child) {
        return { tag: FIELD, key: key, child: child, otherwise: val };
    };

    Decode.optionalAt = function(path, val, child) {
        var dec = child, i = path.length;

        while (i-- > 0) {
            dec = Decode.optionalField(path[i], val, dec);
        }

        return dec;
    };

    return {
        Decode: Decode,

        decode: decode,
        decodeString: function(decoder, str) {
            var val = JSON.parse(str);
            return decode(decoder, val);
        },

        expected: expected,
    };
}));
