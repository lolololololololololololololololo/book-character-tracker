declare module 'cytoscape-edgehandles' {
  import { Core } from 'cytoscape';
  
  interface EdgehandlesOptions {
    canConnect?: (sourceNode: any, targetNode: any) => boolean;
    edgeParams?: (sourceNode: any, targetNode: any) => any;
    hoverDelay?: number;
    snap?: boolean;
    snapThreshold?: number;
    snapFrequency?: number;
    noEdgeEventsInDraw?: boolean;
    disableBrowserGestures?: boolean;
  }
  
  interface EdgehandlesInstance {
    start(sourceNode: any): void;
    stop(): void;
    disable(): void;
    enable(): void;
    enableDrawMode(): void;
    disableDrawMode(): void;
    destroy(): void;
  }
  
  function edgehandles(cytoscape: any): void;
  
  export = edgehandles;
}

declare module 'cytoscape' {
  interface Core {
    edgehandles(options?: any): any;
  }
}