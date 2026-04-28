package com.guamradar.backend;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private final OpenAiChatService chatService;

  public ChatController(OpenAiChatService chatService) {
    this.chatService = chatService;
  }

  @PostMapping
  public ResponseEntity<?> chat(@RequestBody ChatRequest request) {
    try {
      return ResponseEntity.ok(new ChatResponse(chatService.reply(request)));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (IllegalStateException e) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(Map.of("error", e.getMessage()));
    } catch (IOException e) {
      return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(Map.of("error", e.getMessage()));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(Map.of("error", "Chat request was interrupted."));
    }
  }
}
