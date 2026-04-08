declare module 'bpmn-moddle' {
  export class BpmnModdle {
    constructor();
    create(type: string, attrs?: Record<string, any>): any;
    toXML(element: any, options?: { format?: boolean }): Promise<{ xml: string }>;
  }
}

declare module 'bpmn-auto-layout' {
  export function layoutProcess(xml: string): Promise<string>;
}
