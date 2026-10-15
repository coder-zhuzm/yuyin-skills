package example;
import java.util.List;
import org.springframework.stereotype.Service;
@Service
public class OrderService {
    private final OrderMapper mapper;
    public OrderService(OrderMapper mapper) { this.mapper = mapper; }
    public List<Order> list() { return mapper.findAll(); }
}
