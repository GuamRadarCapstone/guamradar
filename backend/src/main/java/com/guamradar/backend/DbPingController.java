package com.guamradar.backend;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DbPingController {
  private final JdbcTemplate jdbc;

  public DbPingController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/db-ping")
  public Map<String, Object> ping() {
    Integer one = jdbc.queryForObject("select 1", Integer.class);
    return Map.of("ok", true, "db", one);
  }
}

