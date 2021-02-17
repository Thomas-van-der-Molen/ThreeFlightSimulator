import * as THREE from "../../threejs/build/three.module.js";
import {EffectComposer} from "../../threejs/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "../../threejs/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "../../threejs/examples/jsm/postprocessing/UnrealBloomPass.js";
import {Vector2} from "../../threejs/build/three.module.js";
import {RESOURCE_MANAGER} from "../io/resourceManager.js";
import {GUI} from "../../threejs/examples/jsm/libs/dat.gui.module.js";
import {FXAAShader} from "../../threejs/examples/jsm/shaders/FXAAShader.js";
import {ShaderPass} from "../../threejs/examples/jsm/postprocessing/ShaderPass.js";

export {GameRenderer}

let rendererInstance = null, fxaaPass = null;

class GameRenderer {

    constructor(clearColor, domElement, gamemode) {

        rendererInstance = this;

        this.sunDirectionVector = gamemode.sunDirectionVector;

        this.clearColor = clearColor ? clearColor : new THREE.Color(0,0,0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({antialias: false});
        this.renderer.autoClear = false;
        this.renderer.setPixelRatio(window.devicePixelRatio * 0.5);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        domElement.appendChild(this.renderer.domElement);

        // Create world render target
        this.sceneRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.sceneRenderTarget.texture.format = THREE.RGBFormat;
        this.sceneRenderTarget.texture.minFilter = THREE.NearestFilter;
        this.sceneRenderTarget.texture.magFilter = THREE.NearestFilter;
        this.sceneRenderTarget.texture.generateMipmaps = false;
        this.sceneRenderTarget.depthBuffer = true;
        this.sceneRenderTarget.depthTexture = new THREE.DepthTexture();
        this.sceneRenderTarget.depthTexture.format = THREE.DepthFormat;
        this.sceneRenderTarget.depthTexture.type = THREE.UnsignedIntType;


        // Create render target scene
        this.renderTargetScene = new THREE.Scene();

        this.renderTargetMaterial = new THREE.ShaderMaterial({
            uniforms: {
                cameraNear: {value: gamemode.camera.near},
                cameraFar: {value: gamemode.camera.far},
                projectionInverseMatrix : {value: null},
                cameraWorldInverseMatrix: {value: null},
                tDiffuse: {value: this.sceneRenderTarget.texture},
                tDepth: {value: this.sceneRenderTarget.depthTexture},
                planetCenter: {value: new THREE.Vector3(0, 0, -9985946)},
                atmosphereRadius: { value: 10000000},
                planetRadius: {value : 4000},
                atmosphereDensityFalloff: {value: 3.9},
                scatterCoefficients: { value: new THREE.Vector3(700, 550, 460)},
                NumScatterPoints: {value : 10},
                NumOpticalDepthPoints: {value : 10},
                sunDirection: {value: new THREE.Vector3(1, 1, 1).normalize()}
            },
            vertexShader: RESOURCE_MANAGER.vertexShader_postProcess,
            fragmentShader: RESOURCE_MANAGER.fragmentShader_postProcess,
        });
        this.renderTargetMaterial.tDiffuse = this.sceneRenderTarget.texture;
        this.renderTargetMaterial.tDepth = this.sceneRenderTarget.depthTexture;

        const obj = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.renderTargetMaterial);
        obj.frustumCulled = false;
        this.renderTargetScene.add(obj);

        // Create composer
        fxaaPass = new ShaderPass(FXAAShader);
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( window.innerHeight * pixelRatio );
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.renderTargetScene, gamemode.camera));
        this.composer.addPass(fxaaPass);
        this.composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.23));



        // Set resize delegate
        window.addEventListener('resize', function () {
            gamemode.camera.aspect = window.innerWidth / window.innerHeight;
            gamemode.camera.updateProjectionMatrix();
            fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( window.innerWidth * pixelRatio);
            fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( window.innerHeight * pixelRatio);
            rendererInstance.renderer.setSize(window.innerWidth, window.innerHeight);
            rendererInstance.composer.setSize(window.innerWidth, window.innerHeight);
            rendererInstance.sceneRenderTarget.setSize(window.innerWidth, window.innerHeight);
        });

        this.scatterValues = new THREE.Vector3(700, 530, 440);
        this.scatteringStrength = 2.62;

        this.gui = new GUI();
        let atmosphereFolder = this.gui.addFolder('atmosphere');
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.atmosphereRadius, 'value', 1000000, 10000000).name('atmosphere radius').listen();
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.planetCenter.value, 'z', -9985946 - 10000, -9985946 + 10000).name('planet z center').listen();
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.planetRadius, 'value', 100000, 10000000).name('planet radius').listen();
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.atmosphereDensityFalloff, 'value', 0.01, 10.0).name('density falloff').listen()
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.NumScatterPoints, 'value', 0, 20).name('Num scatter points').listen();
        atmosphereFolder.add(this.renderTargetMaterial.uniforms.NumOpticalDepthPoints, 'value', 0, 20).name('Num depth points').listen();
        atmosphereFolder.add(this.scatterValues, 'x', 300, 900).name('scatter Red').listen();
        atmosphereFolder.add(this.scatterValues, 'y', 300, 900).name('scatter Green').listen();
        atmosphereFolder.add(this.scatterValues, 'z', 300, 900).name('scatter Blue').listen();
        atmosphereFolder.add(this, 'scatteringStrength', 0, 10).name('scattering strength').listen();
        atmosphereFolder.add(this.sunDirectionVector, 'x', -1, 1).name('sun X').listen();
        atmosphereFolder.add(this.sunDirectionVector, 'y', -1, 1).name('sun Y').listen();
        atmosphereFolder.add(this.sunDirectionVector, 'z', -1, 1).name('sun Z').listen();


    }

    render = function(gamemode) {

        let scatterR = Math.pow(400 / this.scatterValues.x, 4) * this.scatteringStrength;
        let scatterG = Math.pow(400 / this.scatterValues.y, 4) * this.scatteringStrength;
        let scatterB = Math.pow(400 / this.scatterValues.z, 4) * this.scatteringStrength;

        this.sunDirectionVector.normalize();

        this.renderTargetMaterial.uniforms.sunDirection.value.set(-this.sunDirectionVector.x, -this.sunDirectionVector.y, -this.sunDirectionVector.z);
        this.renderTargetMaterial.uniforms.scatterCoefficients.value.set(scatterR, scatterG, scatterB);


        this.renderTargetMaterial.uniforms.projectionInverseMatrix.value = gamemode.camera.projectionMatrixInverse;
        this.renderTargetMaterial.uniforms.cameraWorldInverseMatrix.value = gamemode.camera.matrixWorld;

        this.renderer.setClearColor(this.clearColor, 1);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.renderer.setRenderTarget( this.sceneRenderTarget );
        this.renderer.clear();
        this.renderer.render(gamemode.scene, gamemode.camera);

        this.composer.render();
    }
}