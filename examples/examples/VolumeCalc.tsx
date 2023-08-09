import * as promiseUtils from '@arcgis/core/core/promiseUtils';
import Extent from '@arcgis/core/geometry/Extent';
import ImageryLayer from '@arcgis/core/layers/ImageryLayer';
import ImageryTileLayer from '@arcgis/core/layers/ImageryTileLayer';
import MapView from '@arcgis/core/views/MapView';
import Expand from '@arcgis/core/widgets/Expand';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import { useMemo, useState } from 'react';

import { ArcMapView, ArcUI, ArcWidget, useMapView } from '../../src';
import { ArcImageryLayer } from '../../src/components/ArcLayer/generated/ArcImageryLayer';
import { ArcImageryTileLayer } from '../../src/components/ArcLayer/generated/ArcImageryTileLayer';

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
      debouncedUpdate(event).catch((error: any) => {
        console.error(error);
        if (!promiseUtils.isAbortError(error)) {
          throw error;
        }
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

      // const fetchedPixels = await (layer as ImageryLayer).fetchImage(
      //   requestExtent,
      //   10,
      //   10
      // );
      const fetchedPixels = {
        pixelData: await (layer as unknown as ImageryTileLayer).fetchPixels(
          requestExtent,
          10,
          10
        ),
      };
      console.log('fetchedPixels', fetchedPixels);

      const compare01 = fetchedPixels.pixelData.pixelBlock.pixels[0].every(
        (val: any, index: number) =>
          val === fetchedPixels.pixelData.pixelBlock.pixels[1][index]
      );
      console.log('compare', compare01);

      // return (layer as ImageryLayer)
      //   .identify({ geometry: point })
      //   .then((results: any) => {
      //     console.log('identify results', results);

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
      //   })
      //   .catch((error) => {
      //     if (!promiseUtils.isAbortError(error)) {
      //       throw error;
      //     }
      //   });
    });
  };

  const pixelFilterFunction = (pixelData: __esri.PixelData) => {
    if (pixelData == null || pixelData.pixelBlock == null) {
      return;
    }

    const currentMin = 0;
    const currentMax = 255;

    // The pixelBlock stores the values of all pixels visible in the view
    const pixelBlock = pixelData.pixelBlock;
    console.log(pixelData);
    // The pixels visible in the view
    const pixels = pixelBlock.pixels;
    let mask = pixelBlock.mask;

    console.log('pixelData', pixelBlock, pixels);

    // The number of pixels in the pixelBlock
    const numPixels = pixelBlock.width * pixelBlock.height;

    // Get the min and max values of the data in the current view
    const minVal = pixelData.pixelBlock.statistics[0].minValue ?? 0;
    const maxVal = pixelData.pixelBlock.statistics[0].maxValue;

    // Calculate the factor by which to determine the red and blue
    // values in the colorized version of the layer
    const factor = 255; //.0 / (maxVal - minVal);
    if (pixels == null) {
      return;
    }

    // Get the pixels containing temperature values in the only band of the data
    const tempBand = pixels[0];
    const p1 = pixels[0];
    // Create empty arrays for each of the RGB bands to set on the pixelBlock
    const rBand = new Uint8Array(p1.length);
    const gBand = new Uint8Array(p1.length);
    const bBand = new Uint8Array(p1.length);

    if (mask == null) {
      mask = new Uint8Array(p1.length); //mask = new Uint8Array(p1.length);
      mask.fill(1);
      pixelBlock.mask = mask;
    }

    // Loop through all the pixels in the view
    for (let i = 0; i < numPixels; i++) {
      // skip noData pixels
      if (mask[i] === 0) {
        continue;
      }
      const tempValue = tempBand[i];
      const red = (tempValue - minVal) * factor;
      mask[i] =
        p1[i] >= Math.floor(currentMin) && p1[i] <= Math.floor(currentMax)
          ? 1
          : 0;

      //apply color based on temperature value of each pixel
      if (mask[i]) {
        // p[i] = Math.floor((p1[i] - minVal) * factor);
        rBand[i] = red;
        gBand[i] = 0;
        bBand[i] = 255 - red;
      }
    }

    // Set the new pixel values on the pixelBlock
    // pixelData.pixelBlock.pixels = [rBand, gBand, bBand]; //assign rgb values to each pixel
    // pixelData.pixelBlock.statistics = [];
    // pixelData.pixelBlock.pixelType = "u8";
    pixelData.pixelBlock.pixels = pixelData.pixelBlock.pixels;
    pixelData.pixelBlock.statistics = pixelData.pixelBlock.statistics;
    pixelData.pixelBlock.pixelType = pixelData.pixelBlock.pixelType;
  };

  return (
    <>
      {/* <ArcImageryLayer
        layerProps={{
          url: 'https://iservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeadoLopesMineDemo_CVL_DRMINA_20180626_DSMDynamicImagery/ImageServer', // ImageryLayer
          opacity: 0.9,
          // TODO: pixelFilter only returns one band! why?
          // pixelFilter: pixelFilterFunction,
        }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      /> */}

      <ArcImageryTileLayer
        layerProps={{
          url: 'https://tiledimageservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeaMin_DOMs/ImageServer', // tiled ImageryLayer
          opacity: 0.9,
          // TODO: pixelFilter only returns one band! why?
          // pixelFilter: pixelFilterFunction,
        }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      />
    </>
  );
}
