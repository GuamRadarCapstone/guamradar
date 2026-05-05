package com.guamradar.backend;

import java.io.IOException;

@FunctionalInterface
public interface ChatDeltaHandler {
  void onDelta(String delta) throws IOException;
}
