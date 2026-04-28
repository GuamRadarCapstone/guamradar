package com.guamradar.backend;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

  private final OpenAiChatService chatService;
  private final ChatRequestValidator requestValidator;
  private final ChatRateLimiter rateLimiter;

  public ChatController(
    OpenAiChatService chatService,
    ChatRequestValidator requestValidator,
    ChatRateLimiter rateLimiter
  ) {
    this.chatService = chatService;
    this.requestValidator = requestValidator;
    this.rateLimiter = rateLimiter;
  }

  @PostMapping
  public ResponseEntity<?> chat(@RequestBody ChatRequest request, HttpServletRequest servletRequest) {
    String clientIp = clientIp(servletRequest);
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

  private String clientIp(HttpServletRequest request) {
    String forwardedFor = request.getHeader("X-Forwarded-For");
    if (forwardedFor != null && !forwardedFor.isBlank()) {
      return forwardedFor.split(",")[0].trim();
    }
    String realIp = request.getHeader("X-Real-IP");
    if (realIp != null && !realIp.isBlank()) {
      return realIp.trim();
    }
    return request.getRemoteAddr();
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
