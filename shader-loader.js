/**
 * GLSL Shader Loading Screen - Exact User Shader Implementation
 * Multi-pass: Common -> Buffer A -> Buffer B -> Image
 * Deployment trigger: 2026-01-31
 */

class ShaderLoader {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.programs = {};
        this.framebuffers = {};
        this.textures = {};
        this.startTime = performance.now();
        this.frameCount = 0;
        this.isRunning = true;
        this.transitionStart = 5000; // 5 seconds
        this.transitionDuration = 1500; // 1.5s fade
        this.onComplete = null;
        this.hasError = false;
        this.scrollY = 0;
        this.boundPreventScroll = this.preventScroll.bind(this);
        this.logoOffsetY = 0;

        console.log('[ShaderLoader] Initializing...');
    }

    async init() {
        try {
            this.createCanvas();

            if (!this.setupWebGL()) {
                console.warn('[ShaderLoader] WebGL2 not available, using fallback');
                this.fallbackToCSS();
                return;
            }

            console.log('[ShaderLoader] WebGL2 context created');

            this.createFramebuffers();

            if (!this.compileShaders()) {
                console.error('[ShaderLoader] Shader compilation failed');
                this.fallbackToCSS();
                return;
            }

            console.log('[ShaderLoader] Shaders compiled successfully');

            this.createGeometry();

            // Show the canvas
            this.canvas.style.opacity = '1';

            // Start render loop
            this.startRenderLoop();

            // Start transition timer
            setTimeout(() => {
                this.startTransition();
            }, this.transitionStart);

        } catch (e) {
            console.error('[ShaderLoader] Initialization error:', e);
            this.fallbackToCSS();
        }
    }

    createCanvas() {
        console.log('[ShaderLoader] Creating canvas...');

        // Add loading class to body to hide main content and prevent scrolling
        document.body.classList.add('shader-loading');
        // Prevent any scrolling on mobile during loading (Safari/iOS fix)
        this.lockScroll();

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'shader-loader';

        // Set canvas size to match window size (CSS handles display scaling)
        // Using 1:1 pixel ratio for all devices to avoid rendering issues
        // Round to integers to prevent fractional pixel issues on mobile
        this.canvas.width = Math.floor(window.innerWidth);
        this.canvas.height = Math.floor(window.innerHeight);

        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 99999;
            background: #000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.canvas);

        // Handle resize and orientation change
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('orientationchange', this.handleResize, { passive: true });

        // Use visualViewport API for better mobile handling
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.handleResize, { passive: true });
        }

        console.log('[ShaderLoader] Canvas created:', this.canvas.width, 'x', this.canvas.height);

        // Create logo overlay
        this.logoOverlay = document.createElement('div');
        this.logoOverlay.id = 'shader-logo';
        this.logoOverlay.innerHTML = `
            <svg viewBox="0 0 180 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <!-- Centered H shape with Z inside -->
                <g transform="translate(20, 0)">
                    <path d="M8 8V52M8 30H32M32 8V52" stroke="white" stroke-width="4" stroke-linecap="round"/>
                    <path d="M12 14L28 30L12 46" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    <text x="95" y="38" fill="white" font-family="Inter, sans-serif" font-size="28" font-weight="800" text-anchor="middle">HZ</text>
                </g>
            </svg>
        `;
        const isMobileLogo = window.innerWidth <= 768;
        const logoWidth = isMobileLogo ? 140 : 200;
        const logoHeight = isMobileLogo ? 45 : 60;

        this.logoOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${logoWidth}px;
            height: ${logoHeight}px;
            z-index: 100000;
            opacity: 0;
            transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        `;
        document.body.appendChild(this.logoOverlay);

        // Center logo reliably on mobile (iOS/Safari safe-area/viewport)
        this.updateLogoPosition();

        // Show logo after brief delay
        setTimeout(() => {
            this.logoOverlay.style.opacity = '1';
        }, 500);




    }

    updateLogoPosition() {
        if (!this.logoOverlay) return;
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        const width = vv ? vv.width : window.innerWidth;
        const offsetTop = vv ? vv.offsetTop : 0;
        const offsetLeft = vv ? vv.offsetLeft : 0;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        this.logoOffsetY = isMobile ? Math.round(height * 0.04) : 0;
        this.logoOverlay.style.top = `${offsetTop + height / 2}px`;
        this.logoOverlay.style.left = `${offsetLeft + width / 2}px`;
        this.logoOverlay.style.transform = `translate(-50%, calc(-50% + ${this.logoOffsetY}px))`;
    }

    preventScroll(event) {
        if (!this.isRunning) return;
        event.preventDefault();
    }

    lockScroll() {
        this.scrollY = window.scrollY || window.pageYOffset || 0;

        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overflow = 'hidden';

        // iOS/Safari needs fixed positioning to truly lock scroll
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollY}px`;
        document.body.style.width = '100%';

        // Block touch/scroll events
        document.addEventListener('touchmove', this.boundPreventScroll, { passive: false });
        document.addEventListener('wheel', this.boundPreventScroll, { passive: false });
    }

    unlockScroll() {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';

        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';

        document.removeEventListener('touchmove', this.boundPreventScroll);
        document.removeEventListener('wheel', this.boundPreventScroll);

        if (this.scrollY) {
            window.scrollTo(0, this.scrollY);
        }
    }

    handleResize() {
        if (!this.canvas || this.isTransitioning) return;

        const newWidth = Math.floor(window.innerWidth);
        const newHeight = Math.floor(window.innerHeight);

        // Only update if size actually changed
        if (this.canvas.width === newWidth && this.canvas.height === newHeight) {
            return;
        }

        // Set canvas size to match window size immediately (no debounce)
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        this.updateLogoPosition();

        // Recreate framebuffers with new size
        if (this.gl) {
            this.createFramebuffers();
        }

        console.log('[ShaderLoader] Resized to:', this.canvas.width, 'x', this.canvas.height);
    }

    setupWebGL() {
        console.log('[ShaderLoader] Setting up WebGL2...');

        // MUST use WebGL 2 for this shader (needs uint, bitwise ops, texelFetch)
        this.gl = this.canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            console.error('[ShaderLoader] WebGL2 not supported');
            return false;
        }

        const gl = this.gl;
        console.log('[ShaderLoader] WebGL2 version:', gl.getParameter(gl.VERSION));
        console.log('[ShaderLoader] Renderer:', gl.getParameter(gl.RENDERER));

        // Check for required extensions
        const ext = gl.getExtension('EXT_color_buffer_float');
        if (!ext) {
            console.warn('[ShaderLoader] EXT_color_buffer_float not supported');
        }

        return true;
    }

    // Shader source getters with exact user code
    getCommonShader() {
        return `#define kScreenDownsample 1

vec2 gResolution;
vec2 gFragCoord;
float gTime;
uvec4 rngSeed;
float gDxyDuv;

void SetGlobals(vec2 fragCoord, vec2 resolution, float time)
{
    gFragCoord = fragCoord;
    gResolution = resolution;
    gTime = time;
    gDxyDuv = 1.0 / gResolution.x;
}

#define kPi                    3.14159265359
#define kTwoPi                 (2.0 * kPi)
#define kHalfPi                (0.5 * kPi)
#define kRoot2                 1.41421356237
#define kFltMax                3.402823466e+38
#define kIntMax                0x7fffffff
#define kOne                   vec3(1.0)
#define kZero                  vec3(0.0)
#define kPink                  vec3(1.0, 0.0, 0.2)

float cubrt(float a)           { return sign(a) * pow(abs(a), 1.0 / 3.0); }
float toRad(float deg)         { return kTwoPi * deg / 360.0; }
float toDeg(float rad)         { return 360.0 * rad / kTwoPi; }
float sqr(float a)             { return a * a; }
vec3 sqr(vec3 a)               { return a * a; }
int sqr(int a)                 { return a * a; }
float cub(float a)             { return a * a * a; }
int mod2(int a, int b)         { return ((a % b) + b) % b; }
float mod2(float a, float b)   { return mod(mod(a, b) + b, b); }
vec3 mod2(vec3 a, vec3 b)      { return mod(mod(a, b) + b, b); }
float length2(vec2 v)          { return dot(v, v); }
float length2(vec3 v)          { return dot(v, v); }
int sum(ivec2 a)               { return a.x + a.y; }
float luminance(vec3 v)        { return v.x * 0.17691 + v.y * 0.8124 + v.z * 0.01063; }
float mean(vec3 v)             { return v.x / 3.0 + v.y / 3.0 + v.z / 3.0; }
vec4 mul4(vec3 a, mat4 m)      { return vec4(a, 1.0) * m; }
vec3 mul3(vec3 a, mat4 m)      { return (vec4(a, 1.0) * m).xyz; }
float sin01(float a)           { return 0.5 * sin(a) + 0.5; }
float cos01(float a)           { return 0.5 * cos(a) + 0.5; }
float saturate(float a)        { return clamp(a, 0.0, 1.0); }
vec3 saturate(vec3 a)          { return clamp(a, 0.0, 1.0); }
vec4 saturate(vec4 a)          { return clamp(a, 0.0, 1.0); }
float saw01(float a)           { return abs(fract(a) * 2.0 - 1.0); }
float cwiseMax(vec3 v)         { return (v.x > v.y) ? ((v.x > v.z) ? v.x : v.z) : ((v.y > v.z) ? v.y : v.z); }
float cwiseMax(vec2 v)         { return (v.x > v.y) ? v.x : v.y; }
float cwiseMin(vec3 v)         { return (v.x < v.y) ? ((v.x < v.z) ? v.x : v.z) : ((v.y < v.z) ? v.y : v.z); }
float cwiseMin(vec2 v)         { return (v.x < v.y) ? v.x : v.y; }
void sort(inout float a, inout float b) { if(a > b) { float s = a; a = b; b = s; } }
void swap(inout float a, inout float b) { float s = a; a = b; b = s; }

vec3 safeAtan(vec3 a, vec3 b)
{
    vec3 r;
    #define kAtanEpsilon 1e-10
    r.x = (abs(a.x) < kAtanEpsilon && abs(b.x) < kAtanEpsilon) ? 0.0 : atan(a.x, b.x); 
    r.y = (abs(a.y) < kAtanEpsilon && abs(b.y) < kAtanEpsilon) ? 0.0 : atan(a.y, b.y); 
    r.z = (abs(a.z) < kAtanEpsilon && abs(b.z) < kAtanEpsilon) ? 0.0 : atan(a.z, b.z); 
    return r;
}

float SDFLine(vec2 p, vec2 v0, vec2 v1, float thickness)
{
    v1 -= v0;
    float t = saturate((dot(p, v1) - dot(v0, v1)) / dot(v1, v1));
    vec2 perp = v0 + t * v1;
    return saturate((thickness - length(p - perp)) / gDxyDuv);
}

float SDFQuad(vec2 p, vec2 v[4], float thickness)
{
    float c = 0.0;
    for(int i = 0; i < 4; i++)
    {
        c = max(c, SDFLine(p, v[i], v[(i+1)%4], thickness)); 
    }
    return c;
}

bool IsPointInQuad(vec2 uv, vec2 v[4])
{
    for(int i = 0; i < 4; i++)
    {
        if(dot(uv - v[i], v[i] - v[(i+1)%4]) > 0.0) { return false; }
    }
    return true;
}

mat3 WorldToViewMatrix(float rot, vec2 trans, float sca)
{   
    return mat3(vec3(cos(rot) / sca, sin(rot) / sca, trans.x), 
                vec3(-sin(rot) / sca, cos(rot) / sca, trans.y),
                vec3(1.0));
}

vec2 TransformScreenToWorld(vec2 p)
{   
    return (p - vec2(gResolution.xy) * 0.5) / float(gResolution.y); 
}

vec3 Cartesian2DToBarycentric(vec2 p)
{    
    return vec3(p, 0.0) * mat3(vec3(0.0, 1.0 / 0.8660254037844387, 0.0),
                          vec3(1.0, 0.5773502691896257, 0.0),
                          vec3(-1.0, 0.5773502691896257, 0.0));    
}

vec2 BarycentricToCartesian2D(vec3 b)
{    
    return vec2(b.y * 0.5 - b.z * 0.5, b.x * 0.8660254037844387);    
}

#define kHexRatio vec2(1.5, 0.8660254037844387)

vec2 Cartesian2DToHexagonalTiling(in vec2 uv, out vec3 bary, out ivec2 ij)
{    
    vec2 uvClip = mod(uv + kHexRatio, 2.0 * kHexRatio) - kHexRatio;
    
    ij = ivec2((uv + kHexRatio) / (2.0 * kHexRatio)) * 2;
    if(uv.x + kHexRatio.x <= 0.0) ij.x -= 2;
    if(uv.y + kHexRatio.y <= 0.0) ij.y -= 2;
    
    bary = Cartesian2DToBarycentric(uvClip);
    if(bary.x > 0.0)
    {
        if(bary.z > 1.0) { bary += vec3(-1.0, 1.0, -2.0); ij += ivec2(-1, 1); }
        else if(bary.y > 1.0) { bary += vec3(-1.0, -2.0, 1.0); ij += ivec2(1, 1); }
    }
    else
    {
        if(bary.y < -1.0) { bary += vec3(1.0, 2.0, -1.0); ij += ivec2(-1, -1); }
        else if(bary.z < -1.0) { bary += vec3(1.0, -1.0, 2.0); ij += ivec2(1, -1); }
    }

    return vec2(bary.y * 0.5773502691896257 - bary.z * 0.5773502691896257, bary.x);
}

bool InverseSternograph(inout vec2 uv, float zoom)
{
    float theta = length(uv) * kPi * zoom;
    if(theta >= kPi - 1e-1) { return false; }
    
    float phi = atan(-uv.y, -uv.x) + kPi;
    
    vec3 sph = vec3(cos(phi) * sin(theta), sin(phi) * sin(theta), -cos(theta));
    
    uv = vec2(sph.x / (1.0 - sph.z), sph.y / (1.0 - sph.z));
    return true;
}

float SmoothStep(float a, float b, float x) { return mix(a, b, x * x * (3.0 - 2.0 * x)); }
vec4 SmoothStep(vec4 a, vec4 b, float x)    { return mix(a, b, x * x * (3.0 - 2.0 * x)); }
float SmoothStep(float x)                   { return mix(0.0, 1.0, x * x * (3.0 - 2.0 * x)); }

float PaddedSmoothStep(float x, float a, float b)
{ 
    return SmoothStep(saturate(x * (a + b + 1.0) - a));
}

float PaddedSmoothStep(float x, float a)
{
    return PaddedSmoothStep(x, a, a);
}

float Impulse(float x, float axis, float stdDev)
{
    return exp(-sqr((x - axis) / stdDev));
}

float KickDrop(float t, vec2 p0, vec2 p1, vec2 p2, vec2 p3)
{
    if(t < p1.x)
    {
        return mix(p0.y, p1.y, max(0.0, exp(-sqr((t - p1.x)*2.145966026289347/(p1.x-p0.x))) - 0.01) / 0.99);
    }
    else if(t < p2.x)
    {
        return mix(p1.y, p2.y, (t - p1.x) / (p2.x - p1.x));
    }
    else
    {  
        return mix(p3.y, p2.y, max(0.0, exp(-sqr((t - p2.x)*2.145966026289347/(p3.x-p2.x))) - 0.01) / 0.99);
    }
}

float KickDrop(float t, vec2 p0, vec2 p1, vec2 p2)
{
    return KickDrop(t, p0, p1, p1, p2);
}

uvec4 PCGAdvance()
{
    rngSeed = rngSeed * 1664525u + 1013904223u;
    
    rngSeed.x += rngSeed.y*rngSeed.w; 
    rngSeed.y += rngSeed.z*rngSeed.x; 
    rngSeed.z += rngSeed.x*rngSeed.y; 
    rngSeed.w += rngSeed.y*rngSeed.z;
    
    rngSeed ^= rngSeed >> 16u;
    
    rngSeed.x += rngSeed.y*rngSeed.w; 
    rngSeed.y += rngSeed.z*rngSeed.x; 
    rngSeed.z += rngSeed.x*rngSeed.y; 
    rngSeed.w += rngSeed.y*rngSeed.z;
    
    return rngSeed;
}

vec4 Rand(sampler2D tex)
{
    return texelFetch(tex, (ivec2(gFragCoord) + ivec2(PCGAdvance() >> 16)) % 1024, 0);
}

vec4 Rand()
{
    return vec4(PCGAdvance()) / float(0xffffffffu);
}

void PCGInitialise(uint seed)
{    
    rngSeed = uvec4(20219u, 7243u, 12547u, 28573u) * seed;
}

uint RadicalInverse(uint i)
{
    i = ((i & 0xffffu) << 16u) | (i >> 16u);
    i = ((i & 0x00ff00ffu) << 8u) | ((i & 0xff00ff00u) >> 8u);
    i = ((i & 0x0f0f0f0fu) << 4u) | ((i & 0xf0f0f0f0u) >> 4u);
    i = ((i & 0x33333333u) << 2u) | ((i & 0xccccccccu) >> 2u);    
    i = ((i & 0x55555555u) << 1u) | ((i & 0xaaaaaaaau) >> 1u);        
    return i;
}

float HaltonBase2(uint i)
{    
    return float(RadicalInverse(i)) / float(0xffffffffu);
}

const mat4 kOrderedDither = mat4(vec4(0.0, 8.0, 2.0, 10.), vec4(12., 4., 14., 6.), vec4(3., 11., 1., 9.), vec4(15., 7., 13., 5.));
float OrderedDither()
{    
    return (kOrderedDither[int(gFragCoord.x) & 3][int(gFragCoord.y) & 3] + 1.0) / 17.0;
}

float OrderedDither(ivec2 p)
{    
    return (kOrderedDither[p.x & 3][p.y & 3] + 1.0) / 17.0;
}

#define kFNVPrime              0x01000193u
#define kFNVOffset             0x811c9dc5u
#define kDimsPerBounce         4

uint HashCombine(uint a, uint b)
{
    return (((a << (31u - (b & 31u))) | (a >> (b & 31u)))) ^
            ((b << (a & 31u)) | (b >> (31u - (a & 31u))));
}

uint HashOf(uint i)
{
    uint h = (kFNVOffset ^ (i & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 8u) & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 16u) & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 24u) & 0xffu)) * kFNVPrime;
    return h;
}

uint HashOf(uint a, uint b) { return HashCombine(HashOf(a), HashOf(b)); }
uint HashOf(uint a, uint b, uint c) { return HashCombine(HashCombine(HashOf(a), HashOf(b)), HashOf(c)); }
uint HashOf(uint a, uint b, uint c, uint d) { return HashCombine(HashCombine(HashOf(a), HashOf(b)), HashCombine(HashOf(c), HashOf(d))); }
uint HashOf(ivec2 v) { return HashCombine(HashOf(uint(v.x)), HashOf(uint(v.y))); }

float HashToFloat(uint i)
{    
    return float(i) / float(0xffffffffu);
}

vec3 Hue(float phi)
{
    float phiColour = 6.0 * phi;
    int i = int(phiColour);
    vec3 c0 = vec3(((i + 4) / 3) & 1, ((i + 2) / 3) & 1, ((i + 0) / 3) & 1);
    vec3 c1 = vec3(((i + 5) / 3) & 1, ((i + 3) / 3) & 1, ((i + 1) / 3) & 1);             
    return mix(c0, c1, phiColour - float(i));
}

vec3 HSVToRGB(vec3 hsv)
{
    return mix(vec3(0.0), mix(vec3(1.0), Hue(hsv.x), hsv.y), hsv.z);
}

vec3 RGBToHSV( vec3 rgb)
{
    vec3 hsv;
    hsv.z = cwiseMax(rgb);

    float chroma = hsv.z - cwiseMin(rgb);
    hsv.y = (hsv.z < 1e-10) ? 0.0 : (chroma / hsv.z);

    if (chroma < 1e-10)        { hsv.x = 0.0; }
    else if(hsv.z == rgb.x)    { hsv.x = (1.0 / 6.0) * (rgb.y - rgb.z) / chroma; }
    else if(hsv.z == rgb.y)    { hsv.x = (1.0 / 6.0) * (2.0 + (rgb.z - rgb.x) / chroma); }
    else                        { hsv.x = (1.0 / 6.0) * (4.0 + (rgb.x - rgb.y) / chroma); }
    hsv.x = fract(hsv.x + 1.0);

    return hsv;
}

vec3 Overlay(vec3 a, vec3 b)
{
    return vec3((a.x < 0.5) ? (2.0 * a.x * b.x) : (1.0 - 2.0 * (1.0 - a.x) * (1.0 - b.x)),
                (a.y < 0.5) ? (2.0 * a.y * b.y) : (1.0 - 2.0 * (1.0 - a.y) * (1.0 - b.y)),
                (a.z < 0.5) ? (2.0 * a.z * b.z) : (1.0 - 2.0 * (1.0 - a.z) * (1.0 - b.z)));
}

vec3 SoftLight(vec3 a, vec3 b)
{
    return (kOne - 2.0 * b) * sqr(a) + 2.0 * b * a;
}

float CIEXYZGauss(float lambda, float alpha, float mu, float sigma1, float sigma2)
{
   return alpha * exp(sqr(lambda - mu) / (-2.0 * sqr(lambda < mu ? sigma1 : sigma2)));
}

vec3 SampleSpectrum(float delta)
{
    float lambda = mix(3800.0, 7000.0, delta);    

    #define kRNorm (7000.0 - 3800.0) / 1143.07
    #define kGNorm (7000.0 - 3800.0) / 1068.7
    #define kBNorm (7000.0 - 3800.0) / 1068.25

    vec3 xyz;
    xyz.x = (CIEXYZGauss(lambda, 1.056, 5998.0, 379.0, 310.0) +
             CIEXYZGauss(lambda, 0.362, 4420.0, 160.0, 267.0) +
             CIEXYZGauss(lambda, 0.065, 5011.0, 204.0, 262.0)) * kRNorm;
    xyz.y = (CIEXYZGauss(lambda, 0.821, 5688.0, 469.0, 405.0) +
             CIEXYZGauss(lambda, 0.286, 5309.0, 163.0, 311.0)) * kGNorm;
    xyz.z = (CIEXYZGauss(lambda, 1.217, 4370.0, 118.0, 360.0) +
             CIEXYZGauss(lambda, 0.681, 4590.0, 260.0, 138.0)) * kBNorm;

    vec3 rgb;
    rgb.r = (2.04159 * xyz.x - 0.5650 * xyz.y - 0.34473 * xyz.z) / (2.0 * 0.565);
    rgb.g = (-0.96924 * xyz.x + 1.87596 * xyz.y + 0.04155 * xyz.z) / (2.0 * 0.472);
    rgb.b = (0.01344 * xyz.x - 0.11863 * xyz.y + 1.01517 * xyz.z) / (2.0 * 0.452);

    return rgb;
}

#define kApplyBloom               true
#define kBloomTint                vec3(1.0)
#define kBloomRadius              vec2(0.02 / float(kScreenDownsample))
#define kBloomKernelShape         vec3(1.5, 1.0, 0.7)
#define kBloomDownsample          3
#define kDebugBloom               false
#define kBloomBurnout              vec3(0.2) 

void Gaussian(in int k, in int radius, in vec3 rgbK, in vec3 kernelShape, inout vec3 sigmaL, inout vec3 sigmaWeights)
{
    float d = float(abs(k)) / float(radius);
    vec3 weight = pow(max(vec3(0.), (exp(-sqr(vec3(d) * 4.0)) - 0.0183156) / 0.981684), kernelShape);         

    sigmaL += rgbK * weight;
    sigmaWeights += weight;
}

void Epanechnikov(in int k, in int radius, in vec3 rgbK, in vec3 kernelShape, inout vec3 sigmaL, inout vec3 sigmaWeights)
{
    float d = float(abs(k)) / float(radius);
    float weight = 1. - d*d;

    sigmaL += rgbK * weight;
    sigmaWeights += weight;
}

#define BlurKernel Gaussian

vec3 SeparableBlurDown(ivec2 xy, ivec2 res, sampler2D tex)
{
    if(xy.y == 0 || xy.x >= res.x / kBloomDownsample || xy.y >= res.y / kBloomDownsample)
    {
        return kZero;
    }
    else
    {
        int radius = int(0.5 + float(min(res.x, res.y)) * kBloomRadius.x / float(kBloomDownsample));    
        vec3 sigmaL = kZero, sigmaWeights = kZero;
        for(int k = -radius; k <= radius; ++k)
        {
            ivec2 ij = (xy + ivec2(k, 0)) * kBloomDownsample;
            vec3 texel = texelFetch(tex, ij, 0).xyz;
            texel = max(kZero, texel - vec3(kBloomBurnout));
            BlurKernel(k, radius, texel, kBloomKernelShape, sigmaL, sigmaWeights);
        }

        return sigmaL / max(kOne, sigmaWeights);
    }
}

vec3 SeparableBlurUp(ivec2 xyFrag, ivec2 res, sampler2D tex)
{   
    int radius = int(0.5 + float(min(res.x, res.y)) * kBloomRadius.y / float(kBloomDownsample));    
    vec3 sigmaL = kZero, sigmaWeights = kZero;
    for(int k = -radius; k <= radius; ++k)
    {        
        vec2 uv = (vec2(xyFrag + ivec2(0, k * kBloomDownsample)) - 0.5) / vec2(res);

        // Sample from bloom texture - no division needed since texture fills full 0-1 space
        vec3 texel = texture(tex, uv, 0.0).xyz;
        
        BlurKernel(k, radius, texel, kBloomKernelShape, sigmaL, sigmaWeights);
    }

    return sigmaL / max(kOne, sigmaWeights);
}`;
    }

    getBufferAShader() {
        return `
#define kCaptureTimeDelay 0.0
#define kCaptureTimeSpeed 1.0

vec3 Render(vec2 uvScreen, int idx, int maxSamples, bool isDisplaced, float jpegDamage, out float blend)
{       
    #define kMBlurGain      (isDisplaced ? 100. : 10.0)
    #define kZoomOrder      2
    #define kEndPause       0.0
    #define kSpeed          0.15
     
    vec4 xi = Rand(iChannel0);
    uint hash = HashOf(uint(98796523), uint(gFragCoord.x), uint(gFragCoord.y));        
    xi.y = (float(idx) + HaltonBase2(uint(idx) + hash)) / float(maxSamples);
    xi.x = xi.y;
    float time = 1. * max(0.0, iTime - kCaptureTimeDelay);
    time = (time * kCaptureTimeSpeed + xi.y * kMBlurGain / 60.0) * kSpeed; 
    
    float phase = fract(time);
    int interval = int(time) & 1;    
    interval <<= 1;
    float morph;
    float warpedTime;
    float spectrumBlend;
    #define kIntervalPartition 0.85
    if(phase < kIntervalPartition)
    {
        float y = (interval == 0) ? uvScreen.y : (iResolution.y - uvScreen.y);
        warpedTime = (phase / kIntervalPartition) - 0.2 * sqrt(y / iResolution.y) - 0.1;
        phase = fract(warpedTime);
        morph = 1.0 - PaddedSmoothStep(sin01(kTwoPi * phase), 0., 0.4);
        blend = float(interval / 2) * 0.5;
        if(interval == 2) { warpedTime *= 0.5; }
    }
    else
    {
        time -=  0.8 * kSpeed * xi.y * kMBlurGain / 60.0;
        warpedTime = time;
        phase = (fract(time) - kIntervalPartition) / (1.0 - kIntervalPartition);
        morph = 1.0;
        blend = (KickDrop(phase, vec2(0.0, 0.0), vec2(0.2, -0.1), vec2(0.3, -0.1), vec2(0.7, 1.0)) + float(interval / 2)) * 0.5;        
        interval++;
    }
    
    float beta = abs(2.0 * max(0.0, blend) - 1.0);
    
    #define kMaxIterations  2
    #define kTurns 7
    #define kNumRipples 5
    #define kRippleDelay (float(kNumRipples) / float(kTurns))
    #define kThickness mix(0.5, 0.4, morph)
    #define kExponent mix(0.05, 0.55, morph)
    
    float expMorph = pow(morph, 0.3);
    // Responsive zoom: on narrow/mobile screens (aspect < 1), zoom out more
    float aspectRatio = iResolution.x / iResolution.y;
    float kZoom = aspectRatio < 1.0 ? 0.25 : 0.35;
    #define kScale mix(2.6, 1.1, expMorph)

    mat3 M = WorldToViewMatrix(blend * kTwoPi, vec2(0.0), kZoom);
    vec2 uvView = TransformScreenToWorld(uvScreen);
    int invert = 0;
     
    uvView /= 1.0 + 0.05 * length(uvView) * xi.z;

    uvView = (vec3(uvView, 1.0) * M).xy; 
    
     vec3 bary;
    ivec2 ij;
    Cartesian2DToHexagonalTiling(uvView / 1.4, bary, ij);    
    float len = cwiseMax(abs(bary));
    
    vec2 uvViewWarp = uvView;
    uvViewWarp.y *= mix(1.0, 0.1, sqr(1.0 - morph) * xi.y * saturate(sqr(0.5 * (1.0 + uvView.y))));   
    
    float theta = toRad(30.0) * beta;
    mat2 r = mat2(vec2(cos(theta), -sin(theta)), vec2(sin(theta), cos(theta)));
    uvViewWarp = r * uvViewWarp;    

    vec3 sigma = vec3(0.0);
    for(int iterIdx = 0; iterIdx < kMaxIterations; ++iterIdx)
    {   
        vec3 bary;
        ivec2 ij;
        Cartesian2DToHexagonalTiling(uvViewWarp, bary, ij);        
                        
        if(!isDisplaced && ij != ivec2(0)) { break; }   
        
        int subdiv = 1 + int(exp(-sqr(10. * mix(-1., 1., phase))) * 100.);
        
        float theta = kTwoPi * (floor(cos01(kTwoPi * phase) * 12.) / 6.);
        Cartesian2DToHexagonalTiling(uvViewWarp * (0.1 + float(subdiv)) - kHexRatio.y * vec2(sin(theta), cos(theta)) * floor(0.5 + sin01(kTwoPi * phase) * 2.) / 2., bary, ij);        
        uint hexHash = HashOf(uint(phase * 6.), uint(subdiv), uint(ij.x), uint(ij.y));
        if(hexHash % 2u == 0u)
        {
            float alpha = PaddedSmoothStep(sin01(phase * 20.0), 0.2, 0.75);
            float dist = mix(cwiseMax(abs(bary)), length(uvView) * 2.5, 1.0 - alpha);
            float hashSum = bary[hexHash % 3u] + bary[(hexHash + 1u) % 3u];

            if( dist > 1.0 - 0.02 * float(subdiv)) { invert = invert ^ 1; }
            else if( fract(20. / float(subdiv) * hashSum) < 0.5)  { invert = invert ^ 1; }
            if(iterIdx == 0) break;
        }
        
        float sigma = 0.0, sigmaWeight = 0.0;
        for(int j = 0; j < kTurns; ++j)
        {   
            float delta = float(j) / float(kTurns);
            float theta = kTwoPi * delta;
            for(int i = 0; i < kNumRipples; ++i)
            {
                float l = length(uvViewWarp - vec2(cos(theta), sin(theta))) * 0.5;
                float weight = log2(1.0 / (l + 1e-10));
                sigma += fract(l - pow(fract((float(j) + float(i) / kRippleDelay) / float(kTurns) + warpedTime), kExponent)) * weight;
                sigmaWeight += weight;
            }            
        }
        invert = invert ^ int((sigma / sigmaWeight) > kThickness);
        
        theta = kTwoPi * (floor(cos01(kTwoPi * -phase) * 5. * 6.) / 6.);
        uvViewWarp = r * (uvViewWarp + vec2(cos(theta), sin(theta)) * 0.5);
        uvViewWarp *= kScale; 
    }
    
    sigma = vec3(float(invert != 0));
    
    return mix(1.0 - sigma, sigma * mix(kOne, SampleSpectrum(xi.x), sqr(beta)), beta);
}

bool Interfere(inout vec2 xy, inout vec3 tint, in vec2 res)
{
    #define kStatic true
    #define kStaticFrequency 0.1
    #define kStaticLowMagnitude 0.01
    #define kStaticHighMagnitude 0.02
    
    #define kVDisplace true
    #define kVDisplaceFrequency 0.07
    
    #define kHDisplace true
    #define kHDisplaceFrequency 0.25
    #define kHDisplaceVMagnitude 0.1
    #define kHDisplaceHMagnitude 0.5
    
    float frameHash = HashToFloat(HashOf(uint(iFrame / int(10.0 / kCaptureTimeSpeed))));
    bool isDisplaced = false;
    
    if(kStatic)
    {
        float interP = 0.01, displacement = res.x * kStaticLowMagnitude;
        if(frameHash < kStaticFrequency)
        {
            interP = 0.5;
            displacement = kStaticHighMagnitude * res.x;
            tint = vec3(0.5);
        }

        PCGInitialise(HashOf(uint(xy.y / 2.), uint(iFrame / int(60.0 / (24.0 * kCaptureTimeSpeed)))));
        vec4 xi = Rand();
        if(xi.x < interP) 
        {  
            float mag = mix(-1.0, 1.0, xi.y);        
            xy.x -= displacement * sign(mag) * sqr(abs(mag)); 
        }
    }
    
    if(kVDisplace && frameHash > 1.0 - kVDisplaceFrequency)
    {
        float dispX = HashToFloat(HashOf(8783u, uint(iFrame / int(10.0 / kCaptureTimeSpeed))));
        float dispY = HashToFloat(HashOf(364719u, uint(iFrame / int(12.0 / kCaptureTimeSpeed))));
        
        if(xy.y < dispX * res.y) 
        { 
            xy.y -= mix(-1.0, 1.0, dispY) * res.y * 0.2; 
            isDisplaced = true;
            tint = vec3(3.);
        }
    }
    else if(kHDisplace && frameHash > 1.0 - kHDisplaceFrequency - kVDisplaceFrequency)
    {
        float dispX = HashToFloat(HashOf(147251u, uint(iFrame / int(9.0 / kCaptureTimeSpeed))));
        float dispY = HashToFloat(HashOf(287512u, uint(iFrame / int(11.0 / kCaptureTimeSpeed))));
        float dispZ = HashToFloat(HashOf(8756123u, uint(iFrame / int(7.0 / kCaptureTimeSpeed))));
        
        if(xy.y > dispX * res.y && xy.y < (dispX + mix(0.0, kHDisplaceVMagnitude, dispZ)) * res.y) 
        { 
            xy.x -= mix(-1.0, 1.0, dispY) * res.x * kHDisplaceHMagnitude; 
            isDisplaced = true;
            tint = vec3(3.);
        }
    }
    
    return isDisplaced;
}

void mainImage( out vec4 rgba, in vec2 xy )
{
    rgba = vec4(0.);
    SetGlobals(xy, iResolution.xy, iTime);   
    
    if(xy.x > iResolution.x / float(kScreenDownsample) || xy.y > iResolution.y / float(kScreenDownsample)) { return; }      
    
    xy *= float(kScreenDownsample);
       
    vec3 tint;
    vec2 xyInterfere = xy;
    bool isDisplaced = Interfere(xyInterfere, tint, iResolution.xy);
    
    ivec2 xyDither = ivec2(xy) / int(HashOf(uint(iTime + sin(iTime) * 1.5), uint(xyInterfere.x / 128.), uint(xyInterfere.y / 128.)) & 127u);
    float jpegDamage = OrderedDither(xyDither);
   
    #define kAntiAlias 5
    vec3 rgb = vec3(0.0);
    float blend = 0.0;
    for(int i = 0, idx = 0; i < kAntiAlias; ++i)
    {
        for(int j = 0; j < kAntiAlias; ++j, ++idx)
        {
            vec2 xyAA = xyInterfere + vec2(float(i) / float(kAntiAlias), float(j) / float(kAntiAlias));            
            
            rgb += Render(xyAA, idx, sqr(kAntiAlias), isDisplaced, jpegDamage, blend);
        }
    }
    
    rgb /= float(sqr(kAntiAlias));
    rgb = mix(rgb, Overlay(rgb, vec3(.15, 0.29, 0.39)), blend);
    
    if(isDisplaced)
    {
        #define kColourQuantisation 5
        rgb *= float(kColourQuantisation);
        if(fract(rgb.x) > jpegDamage) rgb.x += 1.0;
        if(fract(rgb.y) > jpegDamage) rgb.y += 1.0;
        if(fract(rgb.z) > jpegDamage) rgb.z += 1.0;
        rgb = floor(rgb) / float(kColourQuantisation);
    }
    
    vec3 hsv = RGBToHSV(rgb);    
    hsv.x += -sin((hsv.x + 0.05) * kTwoPi) * 0.07;
    hsv.y *= 1.0;    
    rgb = HSVToRGB(hsv);
    
    rgba.xyz = rgb;    
    rgba.w = 1.0;
}`;
    }

    getBufferBShader() {
        return `
void mainImage( out vec4 rgba, in vec2 xyScreen )
{
    rgba *= 0.;
    
    if(kApplyBloom)
    {    
        rgba = vec4(SeparableBlurDown(ivec2(xyScreen), ivec2(iResolution.xy), iChannel0), 1.);
    }
}`;
    }

    getImageShader() {
        return `
float Vignette(in vec2 fragCoord)
{
    #define kVignetteStrength         0.5
    #define kVignetteScale            0.6
    #define kVignetteExponent         3.0
    
    vec2 uv = fragCoord / iResolution.xy;
    uv.x = (uv.x - 0.5) * (iResolution.x / iResolution.y) + 0.5;     
    
    float x = 2.0 * (uv.x - 0.5);
    float y = 2.0 * (uv.y - 0.5);
    
    float dist = sqrt(x*x + y*y) / kRoot2;
    
    return mix(1.0, max(0.0, 1.0 - pow(dist * kVignetteScale, kVignetteExponent)), kVignetteStrength);
}

void mainImage( out vec4 rgba, in vec2 xy )
{
    SetGlobals(xy, iResolution.xy, iTime); 
    PCGInitialise(HashOf(uint(iFrame)));
    
    vec3 rgb = kZero;
    
    if(kApplyBloom) { rgb = SeparableBlurUp(ivec2(xy), ivec2(iResolution.xy), iChannel0); }

    rgb += texelFetch(iChannel1, ivec2(xy) / kScreenDownsample, 0).xyz * 0.6;     
    rgb = saturate(rgb);
    rgb = pow(rgb, vec3(0.8));
    rgb = mix(kOne * 0.1, kOne * 0.9, rgb);
    rgb *= Vignette(xy);
    
    rgb = saturate(rgb);
    
    rgba.xyz = rgb;    
    rgba.w = 1.0;
}`;
    }

    createFramebuffers() {
        const gl = this.gl;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clean up existing textures and framebuffers before creating new ones
        // This prevents stale texture data from causing visual artifacts during resize
        if (this.textures.bufferA) {
            gl.deleteTexture(this.textures.bufferA);
            gl.deleteTexture(this.textures.bufferB);
            gl.deleteTexture(this.textures.bufferAPrev);
            gl.deleteFramebuffer(this.framebuffers.bufferA);
            gl.deleteFramebuffer(this.framebuffers.bufferB);
            gl.deleteFramebuffer(this.framebuffers.bufferAPrev);
        }

        // Create textures - use RGBA8 for compatibility
        // Use Math.floor for bufferB to ensure integer dimensions
        this.createTexture('bufferA', w, h);
        this.createTexture('bufferB', Math.max(1, Math.floor(w / 3)), Math.max(1, Math.floor(h / 3)));
        this.createTexture('bufferAPrev', w, h);

        // Create framebuffers
        this.framebuffers.bufferA = this.createFramebuffer(this.textures.bufferA);
        this.framebuffers.bufferB = this.createFramebuffer(this.textures.bufferB);
        this.framebuffers.bufferAPrev = this.createFramebuffer(this.textures.bufferAPrev);
    }

    createTexture(name, w, h) {
        const gl = this.gl;

        // Create texture with explicit black data to prevent stale GPU memory artifacts
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        // Initialize with black pixels to clear any stale GPU memory
        const blackData = new Uint8Array(w * h * 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, blackData);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.textures[name] = tex;
        return tex;
    }

    createFramebuffer(texture) {
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer incomplete:', status);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fb;
    }

    compileShaders() {
        const vsSource = `#version 300 es
            in vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`;

        // Compile each pass
        const bufferAProg = this.compileProgram(vsSource, this.getCommonShader(), this.getBufferAShader(), ['iChannel0']);
        const bufferBProg = this.compileProgram(vsSource, this.getCommonShader(), this.getBufferBShader(), ['iChannel0']);
        const imageProg = this.compileProgram(vsSource, this.getCommonShader(), this.getImageShader(), ['iChannel0', 'iChannel1']);

        if (!bufferAProg || !bufferBProg || !imageProg) {
            return false;
        }

        this.programs.bufferA = bufferAProg;
        this.programs.bufferB = bufferBProg;
        this.programs.image = imageProg;

        return true;
    }

    compileProgram(vsSource, commonSource, fsSource, channelNames) {
        const gl = this.gl;

        const fullFS = `#version 300 es
            precision highp float;
            precision highp int;
            precision highp sampler2D;
            
            uniform float iTime;
            uniform vec2 iResolution;
            uniform int iFrame;
            ${channelNames.map((name, i) => `uniform sampler2D ${name};`).join('\n')}
            
            out vec4 fragColor;
            
            ${commonSource}
            
            ${fsSource}
            
            void main() {
                mainImage(fragColor, gl_FragCoord.xy);
            }`;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);

        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('VS error:', gl.getShaderInfoLog(vs));
            return null;
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fullFS);
        gl.compileShader(fs);

        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('FS error:', gl.getShaderInfoLog(fs));
            return null;
        }

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('Link error:', gl.getProgramInfoLog(prog));
            return null;
        }

        return {
            program: prog,
            uniforms: {
                iTime: gl.getUniformLocation(prog, 'iTime'),
                iResolution: gl.getUniformLocation(prog, 'iResolution'),
                iFrame: gl.getUniformLocation(prog, 'iFrame'),
                iChannel0: gl.getUniformLocation(prog, 'iChannel0'),
                iChannel1: gl.getUniformLocation(prog, 'iChannel1')
            }
        };
    }

    createGeometry() {
        const gl = this.gl;
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]);

        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    renderPass(programInfo, inputTextures, outputFB) {
        const gl = this.gl;

        if (!programInfo) return;

        gl.useProgram(programInfo.program);

        // Bind output and set viewport
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB);

        // Set viewport based on output target
        if (outputFB === null) {
            // Rendering to canvas - use canvas dimensions
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        } else if (outputFB === this.framebuffers.bufferB) {
            // BufferB is at 1/3 resolution
            const w = Math.max(1, Math.floor(this.canvas.width / 3));
            const h = Math.max(1, Math.floor(this.canvas.height / 3));
            gl.viewport(0, 0, w, h);
        } else {
            // bufferA and bufferAPrev are full resolution
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }

        // Set uniforms
        const time = (performance.now() - this.startTime) / 1000;
        gl.uniform1f(programInfo.uniforms.iTime, time);
        gl.uniform2f(programInfo.uniforms.iResolution, this.canvas.width, this.canvas.height);
        gl.uniform1i(programInfo.uniforms.iFrame, this.frameCount);

        // Bind input textures
        inputTextures.forEach((tex, i) => {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            const loc = i === 0 ? programInfo.uniforms.iChannel0 : programInfo.uniforms.iChannel1;
            if (loc) gl.uniform1i(loc, i);
        });

        // Draw
        const posLoc = gl.getAttribLocation(programInfo.program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(posLoc);
    }

    startRenderLoop() {
        const gl = this.gl;

        const loop = () => {
            if (!this.isRunning) return;

            // Render passes
            this.renderPass(this.programs.bufferA, [this.textures.bufferAPrev], this.framebuffers.bufferA);
            this.renderPass(this.programs.bufferB, [this.textures.bufferA], this.framebuffers.bufferB);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this.renderPass(this.programs.image, [this.textures.bufferB, this.textures.bufferA], null);

            // Copy bufferA to bufferAPrev
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffers.bufferA);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffers.bufferAPrev);
            gl.blitFramebuffer(0, 0, this.canvas.width, this.canvas.height,
                0, 0, this.canvas.width, this.canvas.height,
                gl.COLOR_BUFFER_BIT, gl.LINEAR);

            this.frameCount++;
            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    startTransition() {
        console.log('[ShaderLoader] Starting transition');
        const interval = setInterval(() => {
            const elapsed = performance.now() - this.startTime;
            const progress = Math.min((elapsed - this.transitionStart) / this.transitionDuration, 1);

            if (progress >= 0) {
                this.handleTransition(progress);
            }

            if (progress >= 1) {
                clearInterval(interval);
                this.complete();
            }
        }, 16);
    }

    handleTransition(progress) {
        // Background fades first (0-60%)
        const bgFade = Math.min(progress / 0.6, 1);
        this.canvas.style.opacity = 1 - bgFade;

        // Logo fades after (40-100%)
        if (progress > 0.4) {
            const logoFade = (progress - 0.4) / 0.6;
            const logoOpacity = 1 - logoFade;
            const glitchOffset = Math.sin(logoFade * Math.PI * 4) * logoFade * 10;
            this.logoOverlay.style.opacity = logoOpacity;
            this.logoOverlay.style.transform = `translate(calc(-50% + ${glitchOffset}px), calc(-50% + ${this.logoOffsetY}px)) scale(${1 + logoFade * 0.2})`;
            this.logoOverlay.style.filter = `blur(${logoFade * 5}px)`;
        }
    }

    fallbackToCSS() {
        console.log('[ShaderLoader] Using CSS fallback');
        this.hasError = true;

        // Animated gradient fallback
        this.canvas.style.background = '#000';
        this.canvas.style.opacity = '1';

        const pattern = document.createElement('div');
        pattern.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 30% 30%, rgba(245, 166, 35, 0.4) 0%, transparent 50%),
                radial-gradient(circle at 70% 70%, rgba(245, 166, 35, 0.3) 0%, transparent 50%);
            animation: shaderPulse 4s ease-in-out infinite;
        `;
        this.canvas.appendChild(pattern);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes shaderPulse {
                0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
                50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        setTimeout(() => this.startTransition(), this.transitionStart);
    }

    complete() {
        console.log('[ShaderLoader] Complete');
        this.isRunning = false;
        document.body.classList.remove('shader-loading');
        // Restore scrolling
        this.unlockScroll();

        // Cleanup event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.handleResize);
        }
        clearTimeout(this.resizeTimeout);

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        if (this.logoOverlay && this.logoOverlay.parentNode) {
            this.logoOverlay.parentNode.removeChild(this.logoOverlay);
        }
        if (this.skipButton && this.skipButton.parentNode) {
            this.skipButton.parentNode.removeChild(this.skipButton);
        }

        if (this.onComplete) this.onComplete();
        window.dispatchEvent(new CustomEvent('shaderLoaderComplete'));
    }

    destroy() {
        this.isRunning = false;
        const gl = this.gl;

        if (gl) {
            Object.values(this.programs).forEach(p => {
                if (p && p.program) gl.deleteProgram(p.program);
            });
            Object.values(this.framebuffers).forEach(fb => gl.deleteFramebuffer(fb));
            Object.values(this.textures).forEach(t => gl.deleteTexture(t));
            if (this.buffer) gl.deleteBuffer(this.buffer);
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        if (this.logoOverlay && this.logoOverlay.parentNode) {
            this.logoOverlay.parentNode.removeChild(this.logoOverlay);
        }
    }
}

// Auto-initialize
let shaderLoader = null;

function initShaderLoader() {
    console.log('[ShaderLoader] initShaderLoader called');
    shaderLoader = new ShaderLoader();
    shaderLoader.init();
    return shaderLoader;
}

window.ShaderLoader = ShaderLoader;
window.initShaderLoader = initShaderLoader;

if (!window.disableShaderLoader) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShaderLoader);
    } else {
        initShaderLoader();
    }
}
