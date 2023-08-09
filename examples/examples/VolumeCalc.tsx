import * as promiseUtils from '@arcgis/core/core/promiseUtils';
import Extent from '@arcgis/core/geometry/Extent';
import ImageryLayer from '@arcgis/core/layers/ImageryLayer';
import MapView from '@arcgis/core/views/MapView';
import Expand from '@arcgis/core/widgets/Expand';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import { useMemo, useState } from 'react';

import { ArcMapView, ArcUI, ArcWidget, useMapView } from '../../src';
import { ArcImageryLayer } from '../../src/components/ArcLayer/generated/ArcImageryLayer';

export default function VolumeCalc() {
  return (
    <ArcMapView
      map={{ basemap: 'oceans' }}
      center={[-118.805, 34.027]}
      zoom={7}
      style={{ height: '100vh' }}
      eventHandlers={{
        click: (e) => {
          console.log(e.mapPoint);
        },
      }}
    >
      <Layers />
    </ArcMapView>
  );
}

function Layers() {
  const mapView = useMapView();
  // const [mapView, setMapView] = useState<MapView>();
  let layer: ImageryLayer;

  const layerList = useMemo(
    () =>
      new LayerList({
        view: mapView,
      }),
    [mapView]
  );

  const onImgViewCreated = (e: __esri.ImageryLayerLayerviewCreateEvent) => {
    layer = e.layerView.layer as ImageryLayer;
    mapView.goTo(layer.fullExtent);
    console.log('LayerView for imagery created!', layer.title);

    layer.renderer = {
      computeGamma: false,
      dra: false,
      gamma: [1],
      maxPercent: 0.25,
      minPercent: 0.25,
      max: 255,
      min: 0,
      statistics: [
        [
          1197.588_378_906_25, 1481.507_324_218_75, 1315.215_321_200_338_6,
          58.967_350_047_369_77,
        ],
      ],
      useGamma: false,
      stretchType: 'min-max',
      type: 'raster-stretch',
    };

    // // https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-ImageryTileLayer.html#rasterFunction
    // const extractBand = new RasterFunction({
    //   functionName: 'ExtractBand',
    //   functionArguments: {
    //     bandIDs: [0],
    //   },
    // });
    // (layer as ImageryTileLayer).rasterFunction = extractBand;

    mapView.on(['click'], (event: any) => {
      // update mouse location graphic
      // graphic.geometry = view.toMap({ x: event.x, y: event.y });
      // debounce the imagerytilelayer.identify method from
      // pointer-move event to improve performance
      debouncedUpdate(event).catch((error: any) => {
        console.error(error);
        // if (!promiseUtils.isAbortError(error)) {
        //   throw error;
        // }
      });
    });

    const debouncedUpdate = promiseUtils.debounce(async (event: any) => {
      const point = mapView.toMap({ x: event.x, y: event.y });

      const requestExtent = new Extent({
        xmin: point.x,
        ymin: point.y,
        xmax: point.x + 1,
        ymax: point.y + 1,
        spatialReference: { wkid: 102_100 },
      });
      console.log('requestExtent', requestExtent);
      const fetchedPixels = await (layer as ImageryLayer).fetchImage(
        requestExtent,
        10,
        10
      );
      // const fetchedPixels = await (layer as unknown as ImageryTileLayer).fetchPixels(
      //   new Extent({
      //     xmin: point.x,
      //     ymin: point.y,
      //     xmax: point.x + 10,
      //     ymax: point.y + 10,
      //   }),
      //   10,
      //   10
      // );
      console.log(
        'fetchedPixels',
        fetchedPixels,
        fetchedPixels.pixelData.pixelBlock.pixels
      );

      // get pixel values from the pointer location as user moves the
      // pointer over the image. Use pixel values from each band to
      // create a spectral chart. Also calculate the NDVI value for the location.
      return (layer as ImageryLayer)
        .identify({ geometry: point })
        .then((results: any) => {
          console.log('identify results', results);

          // if (results.value) {
          //   document.querySelector('#instruction').style.display = 'none';
          //   // Update the spectral chart for the clicked location on the image
          //   spectralChart.data.datasets[0].data = [];
          //   spectralChart.data.datasets[0].data = results.value;
          //   spectralChart.update(0);
          //   if (chartDiv.style.display === 'none') {
          //     chartDiv.style.display = 'block';
          //   }
          //   document.querySelector(
          //     '#ndviValueDiv'
          //   ).innerHTML = `Processed NDVI value:  ${
          //     (results.processedValue - 100) / 100
          //   }`;
          // } else {
          //   document.querySelector('#instruction').style.display = 'block';
          //   chartDiv.style.display = 'none';
          //   document.querySelector('#ndviValueDiv').innerHTML = '';
          // }
        })
        .catch((error) => {
          if (!promiseUtils.isAbortError(error)) {
            throw error;
          }
        });
    });
  };

  const legend = useMemo(
    () =>
      new Expand({
        view: mapView,
        content: new Legend({
          view: mapView,
        }),
        expandTooltip: 'Legend',
        expanded: true,
      }),
    [mapView]
  );

  return (
    <>
      {/* <ArcMapView
        map={{ portalItem: { id: 'def32d44bec8442ba2ef612bb35ad7bb' } }}
        zoom={15}
        onViewCreated={setMapView}
        style={{ height: '100vh' }}
      >
        <ArcUI position="top-right">
          <ArcWidget widget={layerList} />
        </ArcUI>

        <ArcUI position="bottom-right">
          <ArcWidget widget={legend} />
        </ArcUI>
      </ArcMapView> */}

      <ArcImageryLayer
        layerProps={{
          url: 'https://iservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeadoLopesMineDemo_CVL_DRMINA_20180626_DSMDynamicImagery/ImageServer', // ImageryLayer
          opacity: 0.9,
        }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      />
    </>
  );
}
