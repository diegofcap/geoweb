import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // proxy do WMS
        source: "/geoserver/wms",
        destination: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`,
      },
      {
        // proxy do WFS (se for usar)
        source: "/geoserver/wfs",
        destination: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs`,
      },
    ];
  },
};

export default nextConfig;
