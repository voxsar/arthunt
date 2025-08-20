declare module '@teachablemachine/image' {
  export interface Prediction {
    className: string
    probability: number
  }

  export class CustomMobileNet {
    getTotalClasses(): number
    predict(input: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement): Promise<Prediction[]>
  }

  export class Webcam {
    canvas: HTMLCanvasElement

    constructor(width?: number, height?: number, flip?: boolean)
    setup(constraints?: MediaStreamConstraints): Promise<void>
    play(): Promise<void>
    stop(): void
    update(): void
  }

  export function load(modelURL: string, metadataURL: string): Promise<CustomMobileNet>
}
