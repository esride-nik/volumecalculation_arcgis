import { useEffect, useState } from 'react';
import { layerFactory } from './layerFactory';
import { Overloads } from '../../typings/utilityTypes';
import { ArcReactiveProp } from '../util/ArcReactiveProp';
import { useView } from '../ArcView/ViewContext';

type LayerType = keyof typeof layerFactory;
type AsyncReturnType<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => Promise<infer U>
  ? U
  : T extends (...args: unknown[]) => infer U
  ? U
  : T;

export function ArcLayer<
  LayerName extends LayerType,
  LayerInstance extends ReturnType<
    AsyncReturnType<(typeof layerFactory)[LayerName]>
  >,
  LayerEvents extends Parameters<Overloads<LayerInstance['on']>>
>({
  type,
  layerProps = {},
  onLayerCreated,
  eventHandlers,
}: {
  type: LayerName;
  layerProps?: Parameters<AsyncReturnType<(typeof layerFactory)[LayerName]>>[0];
  onLayerCreated?: (layer: LayerInstance) => void;
  eventHandlers?: {
    [EventName in LayerEvents[0]]?: LayerEvents extends [
      EventName,
      infer CallbackHandler
    ]
      ? CallbackHandler
      : never;
  };
}) {
  const mapView = useView();

  const [layer, setLayer] = useState<LayerInstance>();

  useEffect(() => {
    let destroyed = false;
    let layer: LayerInstance | null = null;
    layerFactory[type]().then((res) => {
      if (destroyed) return;

      layer = res(layerProps as any) as LayerInstance;

      setLayer(layer);
    });

    return () => {
      destroyed = true;
      if (layer) mapView.map.remove(layer);
      layer?.destroy();
    };

    // Only run this effect when the map view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapView]);

  // Add event handlers to the layer
  useEffect(() => {
    if (layer === undefined || !eventHandlers) return;
    const handles = Object.entries(eventHandlers).map(([event, handler]) =>
      layer.on(event as any, handler as any)
    );

    return () => {
      for (const handle of handles) handle.remove();
    };
  }, [eventHandlers, layer]);

  useEffect(() => {
    let destroyed = false;
    if (layer === undefined) return;

    mapView.map.add(layer);

    layer.when(() => {
      if (destroyed || layer === null) return;
      onLayerCreated?.(layer);
    });

    return () => {
      destroyed = true;
      if (layer) mapView.map.remove(layer);
    };
  }, [layer, mapView, onLayerCreated]);

  return (
    <>
      {layerProps &&
        layer &&
        Object.entries(layerProps).map(([key, val]) => (
          <ArcReactiveProp
            key={key}
            accessor={layer}
            property={key}
            value={val}
          />
        ))}
    </>
  );
}
