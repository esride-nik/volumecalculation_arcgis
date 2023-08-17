import * as promiseUtils from '@arcgis/core/core/promiseUtils';
import Extent from '@arcgis/core/geometry/Extent';
import Polygon from '@arcgis/core/geometry/Polygon';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import ImageryLayer from '@arcgis/core/layers/ImageryLayer';
import ImageryTileLayer from '@arcgis/core/layers/ImageryTileLayer';
import LayerList from '@arcgis/core/widgets/LayerList';
import { useMemo } from 'react';

import { ArcSceneView, useSceneView } from '../../src';
import { ArcGraphicsLayer } from '../../src/components/ArcLayer/generated/ArcGraphicsLayer';
import { ArcImageryTileLayer } from '../../src/components/ArcLayer/generated/ArcImageryTileLayer';

export default function VolumeCalc() {
  return (
    <ArcSceneView
      map={{
        basemap: 'oceans',
        ground: {
          navigationConstraint: 'none',
        },
      }}
      extent={{
        spatialReference: { wkid: 102_100 },
        xmin: -4_891_928.102_194_494,
        ymin: -2_307_356.023_380_755_4,
        xmax: -4_891_286.273_486_689,
        ymax: -2_306_865.213_192_433,
      }}
      style={{ height: '100vh' }}
      eventHandlers={{
        click: (e) => {
          console.log(e.mapPoint);
        },
      }}
      viewingMode="local"
      clippingArea={{
        spatialReference: { wkid: 102_100 },
        xmin: -4_891_786.441_670_591,
        ymin: -2_307_257.926_811_594,
        xmax: -4_891_427.934_010_591,
        ymax: -2_306_963.309_761_594_5,
      }}
      popupEnabled={true}
    >
      <Layers />
    </ArcSceneView>
  );
}

function Layers() {
  const mapView = useSceneView();
  let imgLayer: ImageryLayer;
  let volGraphicsLayer: GraphicsLayer;

  const layerList = useMemo(
    () =>
      new LayerList({
        view: mapView,
      }),
    [mapView]
  );

  const onVolGraphicsViewCreated = (e: any) => {
    console.log('onVolGraphicsViewCreated', e);
    volGraphicsLayer = e.layerView.layer as GraphicsLayer;

    // Define elevationInfo and set it on the layer
    const currentElevationInfo = {
      mode: 'relative-to-ground',
      // offset: -1200,
      // featureExpressionInfo: {
      //   expression: 'Geometry($feature).z * 0.5',
      // },
      unit: 'meters',
    } as unknown as __esri.GraphicsLayerElevationInfo;

    volGraphicsLayer.elevationInfo = currentElevationInfo;
  };

  const onImgViewCreated = (e: __esri.ImageryLayerLayerviewCreateEvent) => {
    imgLayer = e.layerView.layer as ImageryLayer;
    mapView.goTo(imgLayer.fullExtent);
    console.log('LayerView for imagery created!', imgLayer.title);

    imgLayer.renderer = {
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

    const create3dGraphics = (
      pixelData: __esri.PixelData,
      zValues: number[],
      symbolColor: string | __esri.Color
    ): Graphic[] => {
      const matrix: number[][][] = [];
      let lastY = -1;

      // eslint-disable-next-line unicorn/no-array-for-each
      zValues
        // eslint-disable-next-line unicorn/no-array-for-each
        .forEach((zValue: number, index: number): void => {
          const posX = index % pixelData.pixelBlock.width;
          const posY = Math.floor(index / pixelData.pixelBlock.height);
          if (lastY !== posY) {
            matrix[posY] = [];
            lastY = posY;
          }
          console.log(posY, posX, zValue);
          matrix[posY][posX] = [
            pixelData.extent.xmin + posX,
            pixelData.extent.ymin + posY,
            zValue * 0.1, // todo: this factor should work in the elevationInfo.featureExpressionInfo but it doesn't! :/
          ];
        });

      console.log(matrix);

      const rings: number[][][] = [];
      const ringCount = 0;
      const mIndex = 0;
      const gs: Graphic[] = [];

      // while (mIndex < matrix.length) {
      //   const oneRing = [];
      //   matrix[mIndex].forEach((zValue: number) => {
      //     oneRing.push([
      //       pixelData.extent.xmin,
      //       pixelData.extent.ymin,
      //       zValue - 1200,
      //     ]);
      //   });
      //   rings[ringCount];
      // }

      const g = new Graphic({
        geometry: new Polygon({
          spatialReference: pixelData.extent.spatialReference,
          rings: matrix,
        }),
        symbol: {
          type: 'polygon-3d',
          symbolLayers: [
            {
              type: 'fill',
              material: {
                color: symbolColor,
              },
              outline: { color: symbolColor },
              edges: {
                type: 'solid',
                color: [50, 50, 50, 0.5],
              },
            },
          ],
        } as unknown as __esri.PolygonSymbol3D,
      });

      return [g];
    };

    const debouncedUpdate = promiseUtils.debounce(async (event: any) => {
      const point = mapView.toMap({ x: event.x, y: event.y });

      const requestExtent = new Extent({
        xmin: point.x,
        ymin: point.y,
        xmax: point.x + 158, // more that 158 return empty pixelBlock! :/
        ymax: point.y + 158,
        spatialReference: { wkid: 102_100 },
      });
      console.log('requestExtent', requestExtent);

      const pixelData = (await (
        imgLayer as unknown as ImageryTileLayer
      ).fetchPixels(requestExtent, 10, 10)) as __esri.PixelData;
      console.log('pixelData', pixelData);

      const volGraphics: Graphic[] = [];
      const poly0 = create3dGraphics(
        pixelData,
        pixelData.pixelBlock.pixels[0] as number[],
        '#FFD700'
      );
      volGraphics.push(...poly0);
      const poly1 = create3dGraphics(
        pixelData,
        pixelData.pixelBlock.pixels[1] as number[],
        '#D700FF'
      );
      volGraphics.push(...poly1);

      // console.log(
      //   'adding graphic',
      //   volGraphics.map((g: Graphic) => g.geometry.rings),
      //   volGraphicsLayer
      // );
      volGraphicsLayer.addMany(volGraphics);
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
    pixelData.pixelBlock.pixels = [rBand, gBand, bBand]; //assign rgb values to each pixel
    pixelData.pixelBlock.statistics = [];
    pixelData.pixelBlock.pixelType = "u8";
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

      <ArcGraphicsLayer
        layerProps={{
          id: 'volumetricGraphics',
        }}
        eventHandlers={{ 'layerview-create': onVolGraphicsViewCreated }}
      />
    </>
  );
}
