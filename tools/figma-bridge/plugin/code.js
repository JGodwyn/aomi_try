"use strict";
// Figma Bridge — Figma plugin main thread.
// Three export modes, all handed to the UI iframe to POST to the local bridge
// (the main thread has no network access):
//   "export"  — serializes the current selection (structure, token/variable
//               bindings, text, assets) → POST /export
//   "context" — serializes a whole-file inventory (pages, top-level frames +
//               thumbnails, variables, styles, components) → POST /context
//   "typography" — serializes the file's local text styles as typography
//                tokens → POST /typography
const MAX_NODES = 4000;
const ICON_MAX_SIZE = 64;
const SCREENSHOT_SCALE = 2;
// File-context thumbnails: small orientation images, not build references.
const THUMB_MAX_PX = 800;
const MAX_THUMBS = 40;
// Component inventory cap — a huge library file shouldn't produce a huge JSON.
const MAX_COMPONENT_ENTRIES = 300;
function slugify(s) {
    const slug = s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "untitled";
}
function round(n) {
    return Math.round(n * 100) / 100;
}
function toHex(c, opacity) {
    const h = (v) => Math.round(v * 255)
        .toString(16)
        .padStart(2, "0");
    const a = "a" in c ? c.a : opacity !== undefined ? opacity : 1;
    const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
    return a >= 1 ? base : `${base}${h(a)}`;
}
async function variableName(alias) {
    if (!alias ||
        typeof alias !== "object" ||
        alias.type !== "VARIABLE_ALIAS") {
        return undefined;
    }
    try {
        const v = await figma.variables.getVariableByIdAsync(alias.id);
        return v ? v.name : undefined;
    }
    catch (_a) {
        return undefined;
    }
}
async function styleName(id) {
    if (typeof id !== "string" || id === "")
        return undefined;
    try {
        const s = await figma.getStyleByIdAsync(id);
        return s ? s.name : undefined;
    }
    catch (_a) {
        return undefined;
    }
}
async function serializePaint(p) {
    var _a;
    if (p.visible === false)
        return undefined;
    const out = { type: p.type };
    if (p.opacity !== undefined && p.opacity < 1)
        out.opacity = round(p.opacity);
    if (p.type === "SOLID") {
        out.color = toHex(p.color, p.opacity);
        const varName = await variableName((_a = p.boundVariables) === null || _a === void 0 ? void 0 : _a.color);
        if (varName)
            out.variable = varName;
    }
    else if (p.type === "GRADIENT_LINEAR" ||
        p.type === "GRADIENT_RADIAL" ||
        p.type === "GRADIENT_ANGULAR" ||
        p.type === "GRADIENT_DIAMOND") {
        out.stops = p.gradientStops.map((s) => ({
            position: round(s.position),
            color: toHex(s.color),
        }));
    }
    else if (p.type === "IMAGE") {
        out.scaleMode = p.scaleMode;
    }
    return out;
}
async function serializePaints(paints) {
    if (paints === figma.mixed || !Array.isArray(paints) || paints.length === 0) {
        return undefined;
    }
    const out = [];
    for (const p of paints) {
        const s = await serializePaint(p);
        if (s)
            out.push(s);
    }
    return out.length > 0 ? out : undefined;
}
function serializeLayout(node) {
    if (!("layoutMode" in node) || node.layoutMode === "NONE")
        return undefined;
    const n = node;
    const layout = {
        direction: n.layoutMode === "HORIZONTAL" ? "row" : "column",
        gap: n.primaryAxisAlignItems === "SPACE_BETWEEN"
            ? "space-between"
            : round(n.itemSpacing),
        padding: [
            round(n.paddingTop),
            round(n.paddingRight),
            round(n.paddingBottom),
            round(n.paddingLeft),
        ],
        justify: n.primaryAxisAlignItems,
        align: n.counterAxisAlignItems,
    };
    if (n.layoutWrap === "WRAP")
        layout.wrap = true;
    return layout;
}
// Sizing behavior inside an auto-layout parent (FIXED / HUG / FILL).
function serializeSizing(node) {
    if (!("layoutSizingHorizontal" in node))
        return undefined;
    try {
        const h = node.layoutSizingHorizontal;
        const v = node.layoutSizingVertical;
        if (h === "FIXED" && v === "FIXED")
            return undefined;
        return { horizontal: h, vertical: v };
    }
    catch (_a) {
        return undefined;
    }
}
function serializeCornerRadius(node) {
    if (!("cornerRadius" in node))
        return undefined;
    const r = node.cornerRadius;
    if (typeof r === "number")
        return r > 0 ? round(r) : undefined;
    // mixed — report per corner
    if ("topLeftRadius" in node) {
        const n = node;
        return [
            round(n.topLeftRadius),
            round(n.topRightRadius),
            round(n.bottomRightRadius),
            round(n.bottomLeftRadius),
        ];
    }
    return undefined;
}
function serializeEffects(node) {
    if (!("effects" in node) || node.effects.length === 0)
        return undefined;
    const out = [];
    for (const e of node.effects) {
        if (e.visible === false)
            continue;
        const item = { type: e.type };
        if ("radius" in e)
            item.radius = round(e.radius);
        if ("color" in e && e.color)
            item.color = toHex(e.color);
        if ("offset" in e && e.offset)
            item.offset = [round(e.offset.x), round(e.offset.y)];
        if ("spread" in e && e.spread)
            item.spread = round(e.spread);
        out.push(item);
    }
    return out.length > 0 ? out : undefined;
}
// Non-paint variable bindings (spacing, radius, size, stroke, opacity, …).
// Paint color bindings are reported inline on each fill/stroke instead.
async function serializeBoundVariables(node) {
    if (!("boundVariables" in node) || !node.boundVariables)
        return undefined;
    const out = {};
    const skip = new Set(["fills", "strokes", "effects", "componentProperties"]);
    for (const [field, value] of Object.entries(node.boundVariables)) {
        if (skip.has(field))
            continue;
        if (Array.isArray(value)) {
            const names = [];
            for (const alias of value) {
                const n = await variableName(alias);
                if (n)
                    names.push(n);
            }
            if (names.length > 0)
                out[field] = names.length === 1 ? names[0] : names;
        }
        else {
            const n = await variableName(value);
            if (n)
                out[field] = n;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
async function serializeText(node) {
    const out = { characters: node.characters };
    try {
        const segments = node.getStyledTextSegments([
            "fontName",
            "fontSize",
            "fontWeight",
            "lineHeight",
            "letterSpacing",
            "fills",
            "textStyleId",
            "fillStyleId",
        ]);
        const segsOut = [];
        for (const seg of segments) {
            const s = {
                text: seg.characters,
                font: `${seg.fontName.family} ${seg.fontName.style}`,
                size: round(seg.fontSize),
                weight: seg.fontWeight,
            };
            if (seg.lineHeight.unit !== "AUTO") {
                s.lineHeight = `${round(seg.lineHeight.value)}${seg.lineHeight.unit === "PERCENT" ? "%" : "px"}`;
            }
            if (seg.letterSpacing.value !== 0) {
                s.letterSpacing = `${round(seg.letterSpacing.value)}${seg.letterSpacing.unit === "PERCENT" ? "%" : "px"}`;
            }
            const fills = await serializePaints(seg.fills);
            if (fills)
                s.fills = fills;
            const tStyle = await styleName(seg.textStyleId);
            if (tStyle)
                s.textStyle = tStyle;
            const fStyle = await styleName(seg.fillStyleId);
            if (fStyle)
                s.fillStyle = fStyle;
            segsOut.push(s);
        }
        // Single uniform segment: flatten it onto the text object for readability.
        if (segsOut.length === 1) {
            const only = segsOut[0];
            delete only.text;
            Object.assign(out, only);
        }
        else {
            out.segments = segsOut;
        }
    }
    catch (e) {
        out.segmentError = String(e);
    }
    if ("textAlignHorizontal" in node && node.textAlignHorizontal !== "LEFT") {
        out.align = node.textAlignHorizontal;
    }
    return out;
}
const VECTOR_TYPES = new Set([
    "VECTOR",
    "BOOLEAN_OPERATION",
    "STAR",
    "POLYGON",
    "LINE",
]);
// Icon heuristic: a small container whose visible leaves are all vector shapes,
// or a bare vector node. Exported as SVG instead of recursing into path data.
function isIconLike(node) {
    if (VECTOR_TYPES.has(node.type))
        return true;
    if ((node.type === "FRAME" ||
        node.type === "GROUP" ||
        node.type === "INSTANCE" ||
        node.type === "COMPONENT") &&
        node.width <= ICON_MAX_SIZE &&
        node.height <= ICON_MAX_SIZE) {
        const leaves = node.findAll((n) => !("children" in n));
        return (leaves.length > 0 &&
            leaves.every((n) => VECTOR_TYPES.has(n.type) ||
                n.type === "ELLIPSE" ||
                n.type === "RECTANGLE" ||
                n.visible === false));
    }
    return false;
}
function hasImageFill(node) {
    if (!("fills" in node))
        return false;
    const fills = node.fills;
    if (fills === figma.mixed || !Array.isArray(fills))
        return false;
    return fills.some((p) => p.type === "IMAGE" && p.visible !== false);
}
class FrameSerializer {
    constructor() {
        this.assets = [];
        this.nodeCount = 0;
        this.truncated = false;
        this.assetNames = new Set();
    }
    assetPath(node, ext) {
        let base = slugify(node.name);
        let candidate = `${base}.${ext}`;
        let i = 2;
        while (this.assetNames.has(candidate)) {
            candidate = `${base}-${i}.${ext}`;
            i++;
        }
        this.assetNames.add(candidate);
        return `assets/${candidate}`;
    }
    async exportAsset(node, format) {
        try {
            const bytes = format === "svg"
                ? await node.exportAsync({ format: "SVG" })
                : await node.exportAsync({
                    format: "PNG",
                    constraint: { type: "SCALE", value: SCREENSHOT_SCALE },
                });
            const path = this.assetPath(node, format);
            this.assets.push({ path, format, b64: figma.base64Encode(bytes) });
            return path;
        }
        catch (_a) {
            return undefined;
        }
    }
    async serialize(node, isRoot) {
        if (node.visible === false)
            return null;
        if (this.nodeCount >= MAX_NODES) {
            this.truncated = true;
            return null;
        }
        this.nodeCount++;
        const out = {
            name: node.name,
            type: node.type,
            w: round(node.width),
            h: round(node.height),
        };
        if (!isRoot) {
            out.x = round(node.x);
            out.y = round(node.y);
        }
        if ("opacity" in node && node.opacity < 1)
            out.opacity = round(node.opacity);
        if (node.type === "INSTANCE") {
            try {
                const main = await node.getMainComponentAsync();
                if (main) {
                    out.component =
                        main.parent && main.parent.type === "COMPONENT_SET"
                            ? main.parent.name
                            : main.name;
                    if (main.parent && main.parent.type === "COMPONENT_SET") {
                        out.variant = main.name;
                    }
                }
                const props = node.componentProperties;
                const propsOut = {};
                for (const [key, prop] of Object.entries(props)) {
                    propsOut[key.split("#")[0]] = prop.value;
                }
                if (Object.keys(propsOut).length > 0)
                    out.props = propsOut;
            }
            catch (_a) {
                // component metadata is best-effort
            }
        }
        const layout = serializeLayout(node);
        if (layout)
            out.layout = layout;
        const sizing = serializeSizing(node);
        if (sizing)
            out.sizing = sizing;
        if ("fills" in node) {
            const fills = await serializePaints(node.fills);
            if (fills)
                out.fills = fills;
            const fStyle = await styleName(node.fillStyleId);
            if (fStyle)
                out.fillStyle = fStyle;
        }
        if ("strokes" in node && node.strokes.length > 0) {
            const strokes = await serializePaints(node.strokes);
            if (strokes) {
                out.strokes = strokes;
                if (typeof node.strokeWeight === "number") {
                    out.strokeWeight = round(node.strokeWeight);
                }
                if ("strokeAlign" in node)
                    out.strokeAlign = node.strokeAlign;
            }
        }
        const radius = serializeCornerRadius(node);
        if (radius !== undefined)
            out.cornerRadius = radius;
        const effects = serializeEffects(node);
        if (effects)
            out.effects = effects;
        const bound = await serializeBoundVariables(node);
        if (bound)
            out.tokens = bound;
        if (node.type === "TEXT") {
            out.text = await serializeText(node);
            return out;
        }
        // Icons become SVG assets; nodes with photo/image fills get a PNG snapshot.
        if (!isRoot && isIconLike(node)) {
            const path = await this.exportAsset(node, "svg");
            if (path) {
                out.asset = path;
                return out;
            }
        }
        if (hasImageFill(node)) {
            const path = await this.exportAsset(node, "png");
            if (path)
                out.asset = path;
        }
        if ("children" in node) {
            const children = [];
            for (const child of node.children) {
                const c = await this.serialize(child, false);
                if (c)
                    children.push(c);
            }
            if (children.length > 0)
                out.children = children;
        }
        return out;
    }
}
async function buildExportPayload() {
    var _a;
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error("Nothing selected — select one or more frames first.");
    }
    const frames = [];
    const usedSlugs = new Set();
    for (const root of selection) {
        let slug = slugify(root.name);
        let i = 2;
        while (usedSlugs.has(slug))
            slug = `${slugify(root.name)}-${i++}`;
        usedSlugs.add(slug);
        const serializer = new FrameSerializer();
        const tree = await serializer.serialize(root, true);
        const screenshot = await root.exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: SCREENSHOT_SCALE },
        });
        frames.push({
            slug,
            name: root.name,
            tree: tree !== null && tree !== void 0 ? tree : {},
            screenshotB64: figma.base64Encode(screenshot),
            assets: serializer.assets,
            nodeCount: serializer.nodeCount,
            truncated: serializer.truncated,
        });
    }
    return {
        file: figma.root.name,
        fileKey: (_a = figma.fileKey) !== null && _a !== void 0 ? _a : null,
        page: figma.currentPage.name,
        exportedAt: new Date().toISOString(),
        frames,
    };
}
// ---------------------------------------------------------------------------
// File context — a whole-file inventory for reasoning about what to build the
// design with, rather than implementing a specific frame.
// ---------------------------------------------------------------------------
// All variable collections in the Figma REST export shape — keyed by
// collection/variable ids, raw values per mode, and VARIABLE_ALIAS links kept
// intact (plus a linkedVariables index) so downstream tools see the token
// graph instead of flattened values.
async function buildVariablesRaw() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const out = {};
    for (const col of collections) {
        const variables = {};
        for (const id of col.variableIds) {
            const v = await figma.variables.getVariableByIdAsync(id);
            if (!v)
                continue;
            const valuesByMode = {};
            const linkedVariables = [];
            for (const [modeId, value] of Object.entries(v.valuesByMode)) {
                if (value &&
                    typeof value === "object" &&
                    value.type === "VARIABLE_ALIAS") {
                    const aliasId = value.id;
                    valuesByMode[modeId] = { type: "VARIABLE_ALIAS", id: aliasId };
                    if (linkedVariables.indexOf(aliasId) === -1)
                        linkedVariables.push(aliasId);
                }
                else if (v.resolvedType === "COLOR" &&
                    value &&
                    typeof value === "object" &&
                    "r" in value) {
                    const c = value;
                    valuesByMode[modeId] = { r: c.r, g: c.g, b: c.b, a: "a" in c ? c.a : 1 };
                }
                else {
                    valuesByMode[modeId] = value;
                }
            }
            variables[v.id] = {
                name: v.name,
                resolvedType: v.resolvedType,
                valuesByMode,
                scopes: v.scopes,
                codeSyntax: v.codeSyntax,
                description: v.description,
                remote: v.remote,
                linkedVariables,
            };
        }
        out[col.id] = {
            name: col.name,
            modes: col.modes.map((m) => ({ name: m.name, modeId: m.modeId })),
            variables,
        };
    }
    return out;
}
// Text styles as typography tokens: CSS-ready strings, css var name derived
// from the last path segment of the style name.
async function buildTypographyTokens(generatedAt) {
    var _a;
    const typography = {};
    for (const s of await figma.getLocalTextStylesAsync()) {
        const size = round(s.fontSize);
        const segments = s.name.split("/");
        const lh = s.lineHeight;
        const token = {
            value: `${size}px ${s.fontName.family}`,
            type: "typography",
            description: s.description || "",
            fontSize: `${size}px`,
            fontFamily: s.fontName.family,
            fontWeight: s.fontName.style,
            letterSpacing: `${round(s.letterSpacing.value)}${s.letterSpacing.unit === "PERCENT" ? "%" : "px"}`,
            lineHeight: lh.unit === "AUTO"
                ? "auto"
                : `${round((_a = lh.value) !== null && _a !== void 0 ? _a : 0)}${lh.unit === "PERCENT" ? "percent" : "pixels"}`,
            css: `var(--${slugify(segments[segments.length - 1])})`,
        };
        // Only non-default text treatments — keeps the common case terse.
        if (s.textCase !== "ORIGINAL")
            token.textCase = s.textCase;
        if (s.textDecoration !== "NONE")
            token.textDecoration = s.textDecoration;
        if (s.paragraphSpacing > 0)
            token.paragraphSpacing = round(s.paragraphSpacing);
        if (s.paragraphIndent > 0)
            token.paragraphIndent = round(s.paragraphIndent);
        typography[s.name] = token;
    }
    return {
        framework: "figma-bridge",
        version: "1.0.0",
        generatedAt,
        tokens: { typography },
    };
}
// Standalone typography export — the same tokens the file-context export
// writes, on their own, so text styles can be refreshed without re-walking
// every page of the file.
async function buildTypographyPayload() {
    var _a;
    const exportedAt = new Date().toISOString();
    const typography = await buildTypographyTokens(exportedAt);
    const tokens = typography.tokens.typography;
    if (Object.keys(tokens).length === 0) {
        throw new Error("This file has no local text styles to export.");
    }
    return {
        file: figma.root.name,
        fileKey: (_a = figma.fileKey) !== null && _a !== void 0 ? _a : null,
        exportedAt,
        typography,
    };
}
async function buildPaintAndEffectStyles() {
    const paintStyles = [];
    for (const s of await figma.getLocalPaintStylesAsync()) {
        const paints = await serializePaints(s.paints);
        paintStyles.push({ name: s.name, paints });
    }
    const effectStyles = (await figma.getLocalEffectStylesAsync()).map((s) => ({
        name: s.name,
        effects: s.effects.map((e) => e.type),
    }));
    return { paintStyles, effectStyles };
}
function buildComponents() {
    const sets = figma.root.findAllWithCriteria({ types: ["COMPONENT_SET"] });
    const components = figma.root.findAllWithCriteria({ types: ["COMPONENT"] });
    const entries = [];
    for (const set of sets) {
        if (entries.length >= MAX_COMPONENT_ENTRIES)
            break;
        const entry = { name: set.name, variants: set.children.length };
        try {
            const props = {};
            for (const [prop, def] of Object.entries(set.variantGroupProperties)) {
                props[prop] = def.values;
            }
            if (Object.keys(props).length > 0)
                entry.props = props;
        }
        catch (_a) {
            // invalid variant setups throw — the name and count are still useful
        }
        entries.push(entry);
    }
    for (const c of components) {
        if (entries.length >= MAX_COMPONENT_ENTRIES)
            break;
        if (c.parent && c.parent.type === "COMPONENT_SET")
            continue; // covered above
        entries.push({ name: c.name });
    }
    return {
        componentSets: sets.length,
        standaloneComponents: components.filter((c) => !c.parent || c.parent.type !== "COMPONENT_SET").length,
        entries,
        entriesTruncated: entries.length >= MAX_COMPONENT_ENTRIES || undefined,
    };
}
async function buildContextPayload() {
    var _a;
    // Under documentAccess: dynamic-page only the current page is loaded until
    // this is called; everything below walks the whole file.
    await figma.loadAllPagesAsync();
    const thumbs = [];
    const usedThumbNames = new Set();
    const pages = [];
    let topLevelFrames = 0;
    for (const page of figma.root.children) {
        const frames = [];
        for (const child of page.children) {
            if (child.visible === false)
                continue;
            const entry = {
                name: child.name,
                type: child.type,
                w: round(child.width),
                h: round(child.height),
            };
            topLevelFrames++;
            if ((child.type === "FRAME" ||
                child.type === "COMPONENT" ||
                child.type === "SECTION") &&
                thumbs.length < MAX_THUMBS &&
                Math.max(child.width, child.height) >= 32) {
                try {
                    const scale = Math.min(1, THUMB_MAX_PX / Math.max(child.width, child.height));
                    const bytes = await child.exportAsync({
                        format: "PNG",
                        constraint: { type: "SCALE", value: scale },
                    });
                    let base = `${slugify(page.name)}--${slugify(child.name)}`;
                    let i = 2;
                    while (usedThumbNames.has(base))
                        base = `${base}-${i++}`;
                    usedThumbNames.add(base);
                    const path = `thumbs/${base}.png`;
                    thumbs.push({ path, b64: figma.base64Encode(bytes) });
                    entry.thumb = path;
                }
                catch (_b) {
                    // thumbnails are best-effort
                }
            }
            frames.push(entry);
        }
        pages.push({ name: page.name, frames });
    }
    const exportedAt = new Date().toISOString();
    const variables = await buildVariablesRaw();
    const typography = await buildTypographyTokens(exportedAt);
    const styles = await buildPaintAndEffectStyles();
    const components = buildComponents();
    const typographyTokens = typography.tokens.typography;
    const fonts = new Set();
    for (const t of Object.values(typographyTokens)) {
        fonts.add(String(t.fontFamily));
    }
    const variableCount = Object.values(variables).reduce((n, c) => n + Object.keys(c.variables).length, 0);
    const context = Object.assign(Object.assign({ pages }, styles), { components, fonts: [...fonts], counts: {
            pages: pages.length,
            topLevelFrames,
            variableCollections: Object.keys(variables).length,
            variables: variableCount,
            textStyles: Object.keys(typographyTokens).length,
            paintStyles: styles.paintStyles.length,
            componentSets: components.componentSets,
            standaloneComponents: components.standaloneComponents,
        } });
    return {
        file: figma.root.name,
        fileKey: (_a = figma.fileKey) !== null && _a !== void 0 ? _a : null,
        exportedAt,
        context,
        variables,
        typography,
        thumbs,
    };
}
figma.showUI(__html__, { width: 300, height: 360 });
figma.ui.onmessage = async (msg) => {
    var _a;
    if (msg.type === "ready") {
        // The UI asks for file identity once its message handler is up — posting
        // right after showUI can race the iframe load. fileKey is undefined in
        // some contexts (e.g. unsaved drafts); the file name is the fallback id.
        figma.ui.postMessage({
            type: "init",
            file: { name: figma.root.name, key: (_a = figma.fileKey) !== null && _a !== void 0 ? _a : null },
        });
    }
    else if (msg.type === "export") {
        try {
            const payload = await buildExportPayload();
            figma.ui.postMessage({ type: "payload", endpoint: "/export", payload });
        }
        catch (e) {
            figma.ui.postMessage({ type: "error", message: String(e) });
        }
    }
    else if (msg.type === "context") {
        try {
            const payload = await buildContextPayload();
            figma.ui.postMessage({ type: "payload", endpoint: "/context", payload });
        }
        catch (e) {
            figma.ui.postMessage({ type: "error", message: String(e) });
        }
    }
    else if (msg.type === "typography") {
        try {
            const payload = await buildTypographyPayload();
            figma.ui.postMessage({
                type: "payload",
                endpoint: "/typography",
                payload,
            });
        }
        catch (e) {
            figma.ui.postMessage({ type: "error", message: String(e) });
        }
    }
    else if (msg.type === "done") {
        figma.notify(`Figma Bridge: exported ${msg.count} files`);
    }
};
