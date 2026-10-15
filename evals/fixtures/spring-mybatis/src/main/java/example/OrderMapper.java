package example;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
@Mapper
public interface OrderMapper { List<Order> findAll(); }
