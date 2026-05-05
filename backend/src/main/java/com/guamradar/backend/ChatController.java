package com.guamradar.backend;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Map;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

  private final OpenAiChatService chatService;
  private final ChatRequestValidator requestValidator;
  private final ChatRateLimiter rateLimiter;
  private final ObjectMapper objectMapper;
  private final ChatPolicyGuard policyGuard;
  private final ChatClientIdentityResolver clientIdentityResolver;

  public ChatController(
    OpenAiChatService chatService,
    ChatRequestValidator requestValidator,
    ChatRateLimiter rateLimiter,
    ObjectMapper objectMapper,
    ChatPolicyGuard policyGuard,
    ChatClientIdentityResolver clientIdentityResolver
  ) {
    this.chatService = chatService;
    this.requestValidator = requestValidator;
    this.rateLimiter = rateLimiter;
    this.objectMapper = objectMapper;
    this.policyGuard = policyGuard;
    this.clientIdentityResolver = clientIdentityResolver;
  }

  @PostMapping
  public ResponseEntity<?> chat(@RequestBody ChatRequest request, HttpServletRequest servletRequest) {
    String clientIp = clientIdentityResolver.resolveClientIp(servletRequest);
    String clientKey = hashClientKey(clientIp);

    if (!rateLimiter.tryAcquire(clientKey)) {
      logger.warn("Chat rate limit exceeded client={}", clientKey);
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .body(new ChatErrorResponse(
          "rate_limited",
          "Too many chat requests. Please wait a few minutes and try again."
        ));
    }

    try {
      requestValidator.validate(request);
      String blockedReply = policyGuard.blockedReply(request);
      if (blockedReply != null) {
        logger.info("Chat request blocked by policy client={}", clientKey);
        return ResponseEntity.ok(new ChatResponse(blockedReply));
      }
      logger.info("Chat request accepted client={} messages={}", clientKey, request.messages().size());
      return ResponseEntity.ok(new ChatResponse(chatService.reply(request)));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest()
        .body(new ChatErrorResponse("invalid_request", e.getMessage()));
    } catch (IllegalStateException e) {
      logger.error("Chat service configuration error: {}", e.getMessage());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(new ChatErrorResponse(
          "chat_unavailable",
          "The GuamRadar assistant is not configured yet."
        ));
    } catch (IOException e) {
      logger.error("Chat provider request failed client={}: {}", clientKey, e.getMessage());
      return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(new ChatErrorResponse(
          "chat_provider_error",
          "The GuamRadar assistant is unavailable right now. Please try again soon."
        ));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(new ChatErrorResponse(
          "chat_interrupted",
          "The GuamRadar assistant was interrupted. Please try again."
        ));
    } catch (Exception e) {
      logger.error("Unexpected chat error client={}", clientKey, e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ChatErrorResponse(
          "chat_error",
          "The GuamRadar assistant hit an unexpected error. Please try again."
        ));
    }
  }

  @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<?> streamChat(@RequestBody ChatRequest request, HttpServletRequest servletRequest) {
    String clientIp = clientIdentityResolver.resolveClientIp(servletRequest);
    String clientKey = hashClientKey(clientIp);

    if (!rateLimiter.tryAcquire(clientKey)) {
      logger.warn("Chat stream rate limit exceeded client={}", clientKey);
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .contentType(MediaType.APPLICATION_JSON)
        .body(new ChatErrorResponse(
          "rate_limited",
          "Too many chat requests. Please wait a few minutes and try again."
        ));
    }

    try {
      requestValidator.validate(request);
      String blockedReply = policyGuard.blockedReply(request);
      if (blockedReply != null) {
        logger.info("Chat stream blocked by policy client={}", clientKey);
        SseEmitter emitter = new SseEmitter(10_000L);
        CompletableFuture.runAsync(() -> {
          sendEvent(emitter, "delta", Map.of("delta", blockedReply));
          sendEvent(emitter, "done", Map.of("done", true));
          emitter.complete();
        });
        return ResponseEntity.ok()
          .contentType(MediaType.TEXT_EVENT_STREAM)
          .header("Cache-Control", "no-cache")
          .body(emitter);
      }
      logger.info("Chat stream accepted client={} messages={}", clientKey, request.messages().size());
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest()
        .contentType(MediaType.APPLICATION_JSON)
        .body(new ChatErrorResponse("invalid_request", e.getMessage()));
    }

    SseEmitter emitter = new SseEmitter(60_000L);

    CompletableFuture.runAsync(() -> {
      try {
        chatService.streamReply(request, (delta) -> sendEvent(emitter, "delta", Map.of("delta", delta)));
        sendEvent(emitter, "done", Map.of("done", true));
        emitter.complete();
      } catch (IllegalStateException e) {
        logger.error("Chat stream configuration error: {}", e.getMessage());
        sendEvent(emitter, "error", Map.of(
          "code", "chat_unavailable",
          "error", "The GuamRadar assistant is not configured yet."
        ));
        emitter.complete();
      } catch (IOException e) {
        logger.error("Chat stream provider request failed client={}: {}", clientKey, e.getMessage());
        sendEvent(emitter, "error", Map.of(
          "code", "chat_provider_error",
          "error", "The GuamRadar assistant is unavailable right now. Please try again soon."
        ));
        emitter.complete();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        sendEvent(emitter, "error", Map.of(
          "code", "chat_interrupted",
          "error", "The GuamRadar assistant was interrupted. Please try again."
        ));
        emitter.complete();
      } catch (Exception e) {
        logger.error("Unexpected chat stream error client={}", clientKey, e);
        sendEvent(emitter, "error", Map.of(
          "code", "chat_error",
          "error", "The GuamRadar assistant hit an unexpected error. Please try again."
        ));
        emitter.complete();
      }
    });

    return ResponseEntity.ok()
      .contentType(MediaType.TEXT_EVENT_STREAM)
      .header("Cache-Control", "no-cache")
      .body(emitter);
  }

  private void sendEvent(SseEmitter emitter, String event, Map<String, ?> payload) {
    try {
      emitter.send(SseEmitter.event()
        .name(event)
        .data(objectMapper.writeValueAsString(payload)));
    } catch (IOException e) {
      throw new IllegalStateException("Failed sending chat stream event.", e);
    }
  }

  private String hashClientKey(String clientIp) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(clientIp.getBytes());
      return HexFormat.of().formatHex(digest).substring(0, 16);
    } catch (NoSuchAlgorithmException e) {
      return "unknown";
    }
  }
}
