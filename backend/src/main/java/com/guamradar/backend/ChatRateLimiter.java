package com.guamradar.backend;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ChatRateLimiter {
  private final Map<String, Deque<Long>> requestsByClient = new ConcurrentHashMap<>();
  private final int maxRequests;
  private final long windowMillis;

  public ChatRateLimiter(
    @Value("${CHAT_RATE_LIMIT_MAX_REQUESTS:20}") int maxRequests,
    @Value("${CHAT_RATE_LIMIT_WINDOW_SECONDS:600}") int windowSeconds
  ) {
    this.maxRequests = Math.max(1, maxRequests);
    this.windowMillis = Duration.ofSeconds(Math.max(1, windowSeconds)).toMillis();
  }

  public boolean tryAcquire(String clientKey) {
    long now = System.currentTimeMillis();
    Deque<Long> requests = requestsByClient.computeIfAbsent(clientKey, ignored -> new ArrayDeque<>());

    synchronized (requests) {
      prune(requests, now);
      if (requests.size() >= maxRequests) {
        return false;
      }
      requests.addLast(now);
      return true;
    }
  }

  private void prune(Deque<Long> requests, long now) {
    long cutoff = now - windowMillis;
    while (!requests.isEmpty() && requests.peekFirst() < cutoff) {
      requests.removeFirst();
    }

    if (requestsByClient.size() <= 1_000) return;
    Iterator<Map.Entry<String, Deque<Long>>> iterator = requestsByClient.entrySet().iterator();
    while (iterator.hasNext()) {
      Deque<Long> clientRequests = iterator.next().getValue();
      synchronized (clientRequests) {
        while (!clientRequests.isEmpty() && clientRequests.peekFirst() < cutoff) {
          clientRequests.removeFirst();
        }
        if (clientRequests.isEmpty()) {
          iterator.remove();
        }
      }
    }
  }
}
