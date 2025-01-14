﻿export type Dictionary<TItem> = { [key: string]: TItem };

export function coalesce(a: any, b: any): any {
    return a != null ? a : b;
}

export function isValue(a: any): boolean {
    return a != null;
}

export let today = (): Date => {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function extend<T = any>(a: T, b: T): T {
    for (var key in b)
        if (Object.prototype.hasOwnProperty.call(b, key))
            a[key] = b[key];
    return a;
}

export function deepClone<T = any>(a: T, a2?: any, a3?: any): T {
    // for backward compatibility
    if (a2 != null || a3 != null) {
        return extend(extend(deepClone(a || {}), deepClone(a2 || {})), deepClone(a3 || {}));
    }

    if (!a)
        return a;
    
    let v: any;
    let b: T = Array.isArray(a) ? [] : {} as any;
    for (const k in a) {
        v = a[k];
        b[k] = (typeof v === "object") ? deepClone(v) : v;
    }
    
    return b;
}

// @ts-ignore check for global
let globalObj: any = typeof (global) !== "undefined" ? global : (typeof (window) !== "undefined" ? window : (typeof (self) !== "undefined" ? self : null));

interface TypeExt {
    __interface?: boolean;
    __interfaces?: any[];
    __isAssignableFrom?: (from: any) => boolean;
    __isInstanceOfType?: (instance: any) => boolean;
    __metadata?: TypeMetadata;
    __metadata$?: TypeMetadata;
    __typeName?: string;
    __typeName$?: string;
}

interface TypeMetadata {
    enumFlags?: boolean;
    attr?: any[];
    members?: TypeMember[];
}

export type Type = Function | Object;

export interface TypeMember {
    name: string;
    type: MemberType;
    attr?: any[];
    getter?: string;
    setter?: string;
}

let types: { [key: string]: Type } = {};

export function getNested(from: any, name: string) {
    var a = name.split('.');
    for (var i = 0; i < a.length; i++) {
        from = from[a[i]];
        if (from == null)
            return null;
    }
    return from;
}

export function getType(name: string, target?: any): Type  {
    var type: any;
    if (target == null) {
        type = types[name];
        if (type != null || globalObj == null || name === "Object")
            return type;

        target = globalObj;
    }

    type = getNested(target, name)
    if (typeof type !== 'function')
        return null;

    return type;
}

export function getTypeFullName(type: Type): string {
    return (type as TypeExt).__typeName || (type as any).name ||
        (type.toString().match(/^\s*function\s*([^\s(]+)/) || [])[1] || 'Object';
};

export function getTypeName(type: Type): string {
    var fullName = getTypeFullName(type);
    var bIndex = fullName.indexOf('[');
    var nsIndex = fullName.lastIndexOf('.', bIndex >= 0 ? bIndex : fullName.length);
    return nsIndex > 0 ? fullName.substr(nsIndex + 1) : fullName;
};

export function getInstanceType(instance: any): any {
    if (instance == null)
        throw new NullReferenceException('Cannot get type of null');

    // Have to catch as constructor cannot be looked up on native COM objects
    try {
        return instance.constructor;
    }
    catch (ex) {
        return Object;
    }
};

export function isAssignableFrom(target: any, type: Type) {
    if (target === type || (type as any).prototype instanceof target)
        return true;

    if (typeof (target as TypeExt).__isAssignableFrom === 'function')
        return (target as TypeExt).__isAssignableFrom(type);

    return false;
};

export function isInstanceOfType(instance: any, type: Type) {
    if (instance == null)
        return false;

    if (typeof (type as TypeExt).__isInstanceOfType === 'function')
        return (type as TypeExt).__isInstanceOfType(instance);

    return isAssignableFrom(type, getInstanceType(instance));
};

export function safeCast(instance: any, type: Type) {
    return isInstanceOfType(instance, type) ? instance : null;
};

export function cast(instance: any, type: Type) {
    if (instance == null)
        return instance;
    else if (isInstanceOfType(instance, type))
        return instance;
    throw new InvalidCastException('Cannot cast object to type ' + getTypeFullName(type));
}

export function getBaseType(type: any) {
    if (type === Object ||
        !type.prototype ||
        (type as TypeExt).__interface === true) {
        return null;
    }
    else if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(type.prototype).constructor;
    }
    else {
        var p = type.prototype;
        if (Object.prototype.hasOwnProperty.call(p, 'constructor')) {
            try {
                var ownValue = p.constructor;
                delete p.constructor;
                return p.constructor;
            }
            finally {
                p.constructor = ownValue;
            }
        }
        return p.constructor;
    }
};

export function getAttributes(type: any, attrType: any, inherit?: boolean) {
    var result = [];
    if (inherit) {
        var b = getBaseType(type);
        if (b) {
            var a: any = getAttributes(b, attrType, true);
            for (var i = 0; i < a.length; i++) {
                var t = getInstanceType(a[i]);
                result.push(a[i]);
            }
        }
    }
    var attr = (type as TypeExt).__metadata?.attr;
    if (attr != null) {
        for (var i = 0; i < attr.length; i++) {
            var a: any = attr[i];
            if (attrType == null || isInstanceOfType(a, attrType)) {
                var t = getInstanceType(a);
                for (var j = result.length - 1; j >= 0; j--) {
                    if (isInstanceOfType(result[j], t))
                        result.splice(j, 1);
                }
                result.push(a);
            }
        }
    }
    return result;
};

export enum MemberType {
    field = 4,
    property = 16
}

export function getMembers(type: any, memberTypes: MemberType): TypeMember[] {
    var result: TypeMember[] = [];
    var b = getBaseType(type);
    if (b)
        result = getMembers(b, memberTypes & ~1);

    var members = (type as TypeExt).__metadata?.members;
    if (members != null) {
        for (var m of members) {
            if (memberTypes & m.type)
                result.push(m);
        }
    }

    return result;
};

export function addTypeMember(type: any, member: TypeMember): TypeMember {

    var name = member.name;
    var md = ensureMetadata(type);
    md.members = md.members || [];

    let existing: TypeMember;
    for (var m of md.members) {
        if (m.name == name) {
            existing = m;
            break;
        }
    }

    if (existing) {
        if (member.type != null)
            existing.type = member.type;
        if (member.attr != null)
            existing.attr = merge(existing.attr, member.attr);
        if (member.getter != null)
            existing.getter = member.getter;
        if (member.setter != null)
            existing.setter = member.setter;
        return existing;
    }
    else {
        md.members.push(member);
        return member;
    }
}

export function getTypes(from?: any): any[] {
    var result = [];
    if (!from) {
        for (var t in types) {
            if (Object.prototype.hasOwnProperty.call(types, t))
                result.push(types[t]);
        }
    }
    else {
        var traverse = function (s: any, n: string) {
            for (var c in s) {
                if (Object.prototype.hasOwnProperty.call(s, c))
                    traverse(s[c], c);
            }
            if (typeof (s) === 'function' &&
                n.charAt(0).toUpperCase() === n.charAt(0) &&
                n.charAt(0).toLowerCase() !== n.charAt(0))
                result.push(s);
        };
        traverse(from, '');
    }
    return result;
};

export function clearKeys(d: any) {
    for (var n in d) {
        if (Object.prototype.hasOwnProperty.call(d, n))
            delete d[n];
    }
}

export function delegateCombine(delegate1: any, delegate2: any) {
    if (!delegate1) {
        if (!delegate2._targets) {
            return delegate2;
        }
        return delegate2;
    }
    if (!delegate2) {
        if (!delegate1._targets) {
            return delegate1;
        }
        return delegate1;
    }

    var targets1 = delegate1._targets ? delegate1._targets : [null, delegate1];
    var targets2 = delegate2._targets ? delegate2._targets : [null, delegate2];

    return _mkdel(targets1.concat(targets2));
};

const fallbackStore: any = {};

export function getStateStore(): any {

    if (typeof globalThis !== "undefined") {
        if (!((globalThis as any).Q))
            (globalThis as any).Q = {};

        var store = (globalThis as any).Q.__stateStore;
        if (!store)
            return ((globalThis as any).Q.__stateStore = {});

        return store;
    }

    return fallbackStore;
}

export namespace Enum {
    export let toString = (enumType: any, value: number): string => {
        var values = enumType;
        if (value === 0 || !((enumType as TypeExt).__metadata?.enumFlags)) {
            for (var i in values) {
                if (values[i] === value) {
                    return i;
                }
            }
            return value == null ? "" : value.toString();
        }
        else {
            var parts: string[] = [];
            for (var i in values) {
                if (values[i] & value) {
                    parts.push(i);
                }
                else
                    parts.push(value == null ? "" : value.toString());
            }
            return parts.join(' | ');
        }
    };

    export let getValues = (enumType: any) => {
        var parts = [];
        var values = enumType;
        for (var i in values) {
            if (Object.prototype.hasOwnProperty.call(values, i) &&
                typeof values[i] === "number")
                parts.push(values[i]);
        }
        return parts;
    };
}

function delegateContains(targets: any[], object: any, method: any) {
    for (var i = 0; i < targets.length; i += 2) {
        if (targets[i] === object && targets[i + 1] === method) {
            return true;
        }
    }
    return false;
};


let _mkdel = (targets: any[]): any => {
    var delegate: any = function () {
        if (targets.length === 2) {
            return targets[1].apply(targets[0], arguments);
        }
        else {
            var clone = targets.slice();
            for (var i = 0; i < clone.length; i += 2) {
                if (delegateContains(targets, clone[i], clone[i + 1])) {
                    clone[i + 1].apply(clone[i], arguments);
                }
            }
            return null;
        }
    };
    delegate._targets = targets;

    return delegate;
};

export let delegateRemove = (delegate1: any, delegate2: any) => {
    if (!delegate1 || (delegate1 === delegate2)) {
        return null;
    }
    if (!delegate2) {
        return delegate1;
    }

    var targets = delegate1._targets;
    var object = null;
    var method;
    if (delegate2._targets) {
        object = delegate2._targets[0];
        method = delegate2._targets[1];
    }
    else {
        method = delegate2;
    }

    for (var i = 0; i < targets.length; i += 2) {
        if ((targets[i] === object) && (targets[i + 1] === method)) {
            if (targets.length === 2) {
                return null;
            }
            var t = targets.slice();
            t.splice(i, 2);
            return _mkdel(t);
        }
    }

    return delegate1;
};

export let isEnum = (type: any) => {
    return typeof type !== "function" &&
        (type as TypeExt).__interface === null;
};

export function initFormType(typ: Function, nameWidgetPairs: any[]) {
    for (var i = 0; i < nameWidgetPairs.length - 1; i += 2) {
        (function (name: string, widget: any) {
            Object.defineProperty(typ.prototype, name, {
                get: function () {
                    return this.w(name, widget);
                },
                enumerable: true,
                configurable: true
            });
        })(nameWidgetPairs[i], nameWidgetPairs[i + 1]);
    }
}

export function prop(type: any, name: string, getter?: string, setter?: string) {
    getter = getter || "get_" + name;
    setter = setter || "set_" + name;

    Object.defineProperty(type.prototype, name, {
        get: function () {
            return this[getter]();
        },
        set: function (value) {
            return this[setter](value);
        },
        configurable: true,
        enumerable: true
    });
}

function ensureMetadata(target: Type): TypeMetadata {

    if (!Object.hasOwnProperty.call(target, '__metadata')) {
        Object.defineProperty(target, '__metadata', {
            get: function () { return Object.prototype.hasOwnProperty.call(this, '__metadata$') ? (this as TypeExt).__metadata$ : void 0; },
            set: function (v) { (this as TypeExt).__metadata$ = v; }
        });
    }
    if (!(target as TypeExt).__metadata) {
        (target as TypeExt).__metadata = Object.create(null);
    }

    return (target as TypeExt).__metadata;
}

function distinct(arr: any[]) {
    return arr.filter((item, pos) => arr.indexOf(item) === pos);
}

const _fieldsProxy = new Proxy({}, { get: (_, p) => p }) as any;

export function fieldsProxy<TRow>(): Readonly<Record<keyof TRow, string>> {
    return _fieldsProxy
}

export function keyOf<T>(prop: keyof T) {
    return prop;
}

function merge(arr1: any[], arr2: any[]) {
    if (!arr1 || !arr2)
        return (arr1 || arr2 || []).slice();

    return distinct(arr1.concat(arr2));
}

function interfaceIsAssignableFrom(from: any) {
    return from != null && (from as TypeExt).__interfaces != null && (from as TypeExt).__interfaces.indexOf(this) >= 0;
}

function registerType(type: any, name: string, intf: any[]) {
    if (name && name.length) {
        setTypeName(type, name);
        types[name] = type;
    }
    else if ((type as TypeExt).__typeName && (type as TypeExt).__typeName.length)
        types[(type as TypeExt).__typeName] = type;

    if (intf != null && intf.length)
        (type as TypeExt).__interfaces = merge((type as TypeExt).__interfaces, intf);
}

export function registerClass(type: any, name: string, intf?: any[]) {
    registerType(type, name, intf);
    (type as TypeExt).__interface = false;
}

export function registerEnum(type: any, name: string) {
    registerType(type, name, undefined);
    (type as TypeExt).__interface = null; // mark as enum
}

export function registerInterface(type: any, name: string, intf?: any[]) {
    registerType(type, name, intf);
    (type as TypeExt).__interface = true;
    (type as TypeExt).__isAssignableFrom = interfaceIsAssignableFrom;
}

export function addAttribute(type: any, attr: any) {
    var md = ensureMetadata(type);
    md.attr = md.attr || [];
    md.attr.push(attr);
}

export function setTypeName(target: Type, value: string) {
    if (!Object.hasOwnProperty.call(target, '__typeName')) {
        Object.defineProperty(target, '__typeName', {
            get: function() { return Object.prototype.hasOwnProperty.call(this, '__typeName$') ? (this as TypeExt).__typeName$ : void 0; },
            set: function(v) { (this as TypeExt).__typeName$ = v; }
        });
    }
    (target as TypeExt).__typeName = value;
}

export class ISlickFormatter {
}

registerInterface(ISlickFormatter, 'Serenity.ISlickFormatter');

export function initializeTypes(root: any, pre: string, limit: number) {

    if (!root)
        return;

    for (var k of Object.keys(root)) {
        if (k.charAt(0) < 'A' || k.charAt(0) > 'Z')
            continue;

        if (k.indexOf('$') >= 0)
            continue;

        if (k === "prototype")
            continue;

        if (!Object.prototype.hasOwnProperty.call(root, k))
            continue;

        var obj = root[k];

        if ($.isArray(obj) ||
            root instanceof Date)
            continue;

        var t = typeof (obj);
        if (t === "string" || t === "number")
            continue;

        if (!(obj as TypeExt).__typeName &&
            ((typeof obj === "function" && obj.nodeType !== "number") || 
             ((obj as TypeExt).__interface !== undefined))) {
   
            if (!obj.__interfaces &&
                obj.prototype &&
                obj.prototype.format &&
                k.substr(-9) === "Formatter") {
                if ((obj as TypeExt).__interface === undefined)
                    (obj as TypeExt).__interface = false;
                (obj as TypeExt).__interfaces = [ISlickFormatter]
            }

            if ((obj as TypeExt).__interface === undefined) {
                var baseType = getBaseType(obj);
                if (baseType && (baseType as TypeExt).__interface === false) {
                    (obj as TypeExt).__interface = false;
                }
            }

            if ((obj as TypeExt).__interface !== undefined) {
                setTypeName(obj, pre + k);
                types[pre + k] = obj;
            }
        }
        
        if (limit > 0) 
            initializeTypes(obj, pre + k + ".", limit - 1);
    }
}

export class Exception extends Error {
    constructor(message: string) {
        super(message);
        this.name = "Exception";
    }
}

export class NullReferenceException extends Exception {
    constructor(message?: string) {
        super(message || 'Object is null.');
        this.name = "NullReferenceException";
    }
}

export class ArgumentNullException extends Exception {
    constructor(paramName: string, message?: string) {
        super((message || 'Value cannot be null.') + '\nParameter name: ' + paramName);
        this.name = "ArgumentNullException";
    }
}

export class ArgumentOutOfRangeException extends Exception {
    constructor(paramName: string, message?: string) {
        super((message ?? 'Value is out of range.') +
            (paramName ? ('\nParameter name: ' + paramName) : ""));
        this.name = "ArgumentNullException";
    }
}

export class InvalidCastException extends Exception {
    constructor(message: string) {
        super(message);
        this.name = "InvalidCastException";
    }
}

export {}