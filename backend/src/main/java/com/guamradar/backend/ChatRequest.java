package com.guamradar.backend;

import java.util.List;
import java.util.Map;

public record ChatRequest(
  List<ChatMessage> messages,
  Map<String, Object> context
) {}
